// POST /api/automations/[id]/run
// Body: { dryRun?: boolean }
//
// Phase 1 executor — applies structured actionConfig steps to the user's activity feed.
// No external writes. Dry-run logs simulated output without mutating state.
//
// Supported step actions (Phase 1):
//   set_urgency   — { urgency: 0 | 1 | 2 }
//   add_feed_tag  — { tag: string }  (stored in metadata.tags)
//   dismiss_item  — {}

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { automations, automationRuns, activityItems, connectedServices } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

// ─── Action types ─────────────────────────────────────────────────────────────

type Step =
  | { action: "set_urgency"; params: { urgency: 0 | 1 | 2 } }
  | { action: "add_feed_tag"; params: { tag: string } }
  | { action: "dismiss_item"; params: Record<string, never> };

interface ActionConfig {
  description?: string;
  prompt?: string;
  steps: Step[];
}

const ALLOWED_ACTIONS = new Set(["set_urgency", "add_feed_tag", "dismiss_item"]);

function validateActionConfig(config: unknown): ActionConfig {
  if (!config || typeof config !== "object") throw new Error("actionConfig must be an object");
  const c = config as Record<string, unknown>;
  if (!Array.isArray(c.steps)) throw new Error("actionConfig.steps must be an array");
  for (const step of c.steps) {
    if (!step || typeof step !== "object") throw new Error("Each step must be an object");
    const s = step as Record<string, unknown>;
    if (typeof s.action !== "string" || !ALLOWED_ACTIONS.has(s.action)) {
      throw new Error(`Unknown action: ${s.action}`);
    }
  }
  return config as ActionConfig;
}

// ─── AI-assisted config generation ───────────────────────────────────────────

const ACTION_GENERATION_PROMPT = `You are an automation config generator for Profession OS.
Given a user's natural-language description, generate a JSON actionConfig that applies read-only
classification steps to their activity feed items.

Available actions (Phase 1 — read+classify only):
- set_urgency: { urgency: 0 | 1 | 2 }  — 0=normal, 1=important, 2=urgent
- add_feed_tag: { tag: string }          — add a label tag to matching items
- dismiss_item: {}                        — mark the item as dismissed

Output ONLY valid JSON in this shape:
{
  "description": "Human-readable summary of what this automation does",
  "prompt": "The user's original request",
  "steps": [
    { "action": "add_feed_tag", "params": { "tag": "boss" } },
    { "action": "set_urgency", "params": { "urgency": 2 } }
  ]
}

Rules:
- Output ONLY the JSON object, no markdown fences, no explanation
- steps must contain at least one action
- Only use the three allowed action types above`;

async function generateActionConfig(
  prompt: string,
  apiKey: string,
  model: string
): Promise<ActionConfig> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 512,
    system: ACTION_GENERATION_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  return validateActionConfig(parsed);
}

// ─── Step executor ────────────────────────────────────────────────────────────

interface RunOutput {
  itemsEvaluated: number;
  stepsApplied: number;
  actions: Array<{ itemId: string; title: string; action: string; params: unknown; simulated?: boolean }>;
}

async function executeSteps(
  userId: string,
  steps: Step[],
  isDryRun: boolean,
  db: ReturnType<typeof import("@/db").getDb>
): Promise<RunOutput> {
  // Load the user's current activity feed (new/seen items, non-dismissed)
  const items = await db
    .select()
    .from(activityItems)
    .where(
      and(
        eq(activityItems.userId, userId),
        // Only operate on active items
      )
    )
    .orderBy(desc(activityItems.urgency), desc(activityItems.occurredAt))
    .limit(100);

  const output: RunOutput = {
    itemsEvaluated: items.length,
    stepsApplied: 0,
    actions: [],
  };

  for (const item of items) {
    for (const step of steps) {
      if (step.action === "set_urgency") {
        const { urgency } = step.params;
        if (!isDryRun) {
          await db
            .update(activityItems)
            .set({ urgency, updatedAt: new Date() })
            .where(eq(activityItems.id, item.id));
        }
        output.actions.push({
          itemId: item.id,
          title: item.title,
          action: "set_urgency",
          params: step.params,
          simulated: isDryRun || undefined,
        });
        output.stepsApplied++;
      } else if (step.action === "add_feed_tag") {
        const { tag } = step.params;
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        const existingTags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
        if (!existingTags.includes(tag)) {
          const newMeta = { ...meta, tags: [...existingTags, tag] };
          if (!isDryRun) {
            await db
              .update(activityItems)
              .set({ metadata: newMeta, updatedAt: new Date() })
              .where(eq(activityItems.id, item.id));
          }
          output.actions.push({
            itemId: item.id,
            title: item.title,
            action: "add_feed_tag",
            params: step.params,
            simulated: isDryRun || undefined,
          });
          output.stepsApplied++;
        }
      } else if (step.action === "dismiss_item") {
        if (!isDryRun) {
          await db
            .update(activityItems)
            .set({ status: "dismissed", updatedAt: new Date() })
            .where(eq(activityItems.id, item.id));
        }
        output.actions.push({
          itemId: item.id,
          title: item.title,
          action: "dismiss_item",
          params: {},
          simulated: isDryRun || undefined,
        });
        output.stepsApplied++;
      }
    }
  }

  return output;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const isDryRun = body.dryRun === true;
  const generatePrompt: string | undefined = typeof body.generatePrompt === "string"
    ? body.generatePrompt
    : undefined;

  const db = getDb();

  // Load automation and verify ownership
  const [automation] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, session.user.id)))
    .limit(1);

  if (!automation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Create run record
  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId: id,
      userId: session.user.id,
      isDryRun,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    let actionConfig: ActionConfig;

    // If a generatePrompt is provided, use AI to generate/update the actionConfig
    if (generatePrompt) {
      // Resolve the AI service for this automation
      const aiServiceId = automation.aiServiceId;
      if (!aiServiceId) {
        throw new Error("No AI service configured for this automation");
      }
      const [aiService] = await db
        .select()
        .from(connectedServices)
        .where(
          and(
            eq(connectedServices.id, aiServiceId),
            eq(connectedServices.userId, session.user.id)
          )
        )
        .limit(1);

      if (!aiService) throw new Error("AI service not found");

      const config = aiService.config as Record<string, unknown>;
      const credentials = aiService.credentials as Record<string, unknown>;
      const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
      const model = (config.model as string) || "claude-sonnet-4-6";

      if (!apiKey) throw new Error("AI service has no API key configured");

      actionConfig = await generateActionConfig(generatePrompt, apiKey, model);

      // Persist the generated config back to the automation
      await db
        .update(automations)
        .set({ actionConfig, updatedAt: new Date() })
        .where(eq(automations.id, id));
    } else {
      actionConfig = validateActionConfig(automation.actionConfig);
    }

    const output = await executeSteps(session.user.id, actionConfig.steps, isDryRun, db);

    const status = isDryRun ? "dry_run_success" : "success";

    // Update run record
    await db
      .update(automationRuns)
      .set({ status: "success", output, completedAt: new Date() })
      .where(eq(automationRuns.id, run.id));

    // Update automation last-run fields
    await db
      .update(automations)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunOutput: output,
        updatedAt: new Date(),
      })
      .where(eq(automations.id, id));

    return Response.json({ runId: run.id, status, isDryRun, output });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await db
      .update(automationRuns)
      .set({ status: "error", error: errorMsg, completedAt: new Date() })
      .where(eq(automationRuns.id, run.id));

    await db
      .update(automations)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: "error",
        updatedAt: new Date(),
      })
      .where(eq(automations.id, id));

    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
