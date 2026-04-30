// POST /api/automations/preview-config
// Generates a preview actionConfig from a natural-language prompt using the user's AI service.
// Returns { actionConfig, summary } without persisting anything.
// Used by the automation creation chat panel to show the user what will be built.

export const dynamic = "force-dynamic";

import Anthropic from "@anthropic-ai/sdk";
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const ALLOWED_ACTIONS = new Set(["set_urgency", "add_feed_tag", "dismiss_item"]);

const SYSTEM_PROMPT = `You are an automation config generator for Profession OS.
Given a user's natural-language description, generate a JSON actionConfig that applies read-only
classification steps to their activity feed items.

Available actions (Phase 1 — read+classify only):
- set_urgency: { urgency: 0 | 1 | 2 }  — 0=normal, 1=important, 2=urgent
- add_feed_tag: { tag: string }          — add a label tag to matching items
- dismiss_item: {}                        — mark the item as dismissed

Output ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "description": "Human-readable summary of what this automation does",
  "prompt": "The user's original request verbatim",
  "steps": [
    { "action": "add_feed_tag", "params": { "tag": "boss" } },
    { "action": "set_urgency", "params": { "urgency": 2 } }
  ]
}

Rules:
- Output ONLY the JSON object
- steps must contain at least one action
- Only use the three allowed action types above
- Be concise in the description (one sentence)`;

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const prompt: string = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const aiServiceId: string = typeof body.aiServiceId === "string" ? body.aiServiceId : "";

  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });
  if (!aiServiceId) return Response.json({ error: "aiServiceId is required" }, { status: 400 });

  const db = getDb();

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

  if (!aiService) {
    return Response.json({ error: "AI service not found" }, { status: 404 });
  }

  const config = aiService.config as Record<string, unknown>;
  const credentials = aiService.credentials as Record<string, unknown>;
  const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
  const model = (config.model as string) || "claude-sonnet-4-6";

  if (!apiKey) {
    return Response.json({ error: "AI service has no API key configured" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned) as {
      description?: string;
      prompt?: string;
      steps: Array<{ action: string; params: unknown }>;
    };

    // Validate
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error("Generated config has no steps");
    }
    for (const step of parsed.steps) {
      if (!ALLOWED_ACTIONS.has(step.action)) {
        throw new Error(`Unknown action: ${step.action}`);
      }
    }

    return Response.json({
      actionConfig: parsed,
      summary: parsed.description ?? "Automation config generated.",
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate config" },
      { status: 500 }
    );
  }
}
