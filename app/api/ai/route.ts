// AI chat endpoint — streams a real Claude response when the user has a claude-ai
// connectedService configured; falls back to a simulated word-by-word response otherwise.
// Persists conversations and messages to the DB when the user is authenticated.

export const dynamic = "force-dynamic";

import Anthropic from "@anthropic-ai/sdk";
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems, aiConversations, aiMessages, customPlugins } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Fallback simulated responses ─────────────────────────────────────────────

const RESPONSES: Record<string, string> = {
  default:
    "I'm analysing your workflow now. Based on your activity, you have 3 calendar conflicts on Thursday and an elevated email volume. Want me to suggest reschedules or draft replies?",
  conflict:
    "Your Thursday conflicts involve the Strategy sync (2–3 pm) overlapping with 1:1 Andy and Team standup. I'd suggest moving 1:1 Andy to Friday at 10 am — you're both free. Shall I send a reschedule invite?",
  email:
    "Your inbox has 131 unread messages — 22% higher than yesterday. The main drivers are Q2 planning threads from Finance (+18), a vendor renewal thread from Procurement (+12), and the usual daily digests. I can draft responses to the action-required ones if you like.",
  pr:
    "You have 13 open PRs. Two are stale (no activity in 5+ days): feature/auth-refactor and fix/checkout-race. The rest are actively reviewed. Want me to post a nudge comment on the stale ones?",
  messaging:
    "You're mentioned 7 times across #eng, #product, and #design. The highest-priority thread is the checkout error in #eng — the team is investigating and expects a root-cause in ~30 minutes.",
  error:
    "The /api/checkout error spike started at 09:47 and is now at 12% failure rate. Sentry trace shows a null-pointer in the PaymentService.processCard method — looks like a null customer ID on guest checkout. Do you want me to surface the relevant code diff?",
  summary:
    "Here's your morning summary: 131 emails (3 need replies), 13 calendar events today (3 conflicts on Thursday), 261 messages unread (7 direct mentions), and 1 active P0 incident on /api/checkout. Overall risk level: elevated. I recommend addressing the checkout error first.",
};

function pickResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  if (lower.includes("conflict") || lower.includes("calendar") || lower.includes("meeting")) {
    return RESPONSES.conflict;
  }
  if (lower.includes("email") || lower.includes("inbox") || lower.includes("mail")) {
    return RESPONSES.email;
  }
  if (lower.includes("pr") || lower.includes("pull request") || lower.includes("code")) {
    return RESPONSES.pr;
  }
  if (lower.includes("slack") || lower.includes("message")) {
    return RESPONSES.messaging;
  }
  if (lower.includes("error") || lower.includes("spike") || lower.includes("checkout")) {
    return RESPONSES.error;
  }
  if (lower.includes("summary") || lower.includes("status") || lower.includes("today")) {
    return RESPONSES.summary;
  }
  return RESPONSES.default;
}

function simulatedStream(text: string, conversationId?: string): Response {
  const encoder = new TextEncoder();
  const words = text.split(" ");
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        controller.enqueue(encoder.encode(words[i] + (i < words.length - 1 ? " " : "")));
        await new Promise<void>((r) => setTimeout(r, 45));
      }
      controller.close();
    },
  });
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  };
  if (conversationId) headers["X-Conversation-Id"] = conversationId;
  return new Response(stream, { headers });
}

// ─── Context builder ───────────────────────────────────────────────────────────

type ActivityRow = {
  itemType: string;
  title: string;
  urgency: number;
  body: string | null;
  occurredAt: Date | null;
};

function buildSystemPrompt(items: ActivityRow[]): string {
  const urgencyLabel = (u: number) => (u === 2 ? "URGENT" : u === 1 ? "IMPORTANT" : "normal");

  const itemLines = items.map((item, i) => {
    const when = item.occurredAt
      ? item.occurredAt.toISOString().replace("T", " ").slice(0, 16) + " UTC"
      : "unknown time";
    const body = item.body ? ` — ${item.body.slice(0, 120)}` : "";
    return `${i + 1}. [${urgencyLabel(item.urgency)}] ${item.itemType.toUpperCase()}: ${item.title}${body} (${when})`;
  });

  const contextBlock =
    itemLines.length > 0
      ? `\n\nThe user's current activity feed (sorted by priority):\n${itemLines.join("\n")}`
      : "\n\nThe user has no recent activity items.";

  return (
    "You are a professional productivity assistant embedded in Profession OS — a unified dashboard that aggregates activity from email, calendar, tasks, and other services. " +
    "Your role is to help the user stay on top of their work: summarise what's happening, flag priorities, and suggest concrete next actions. " +
    "Be concise and direct. When you recommend an action, be specific." +
    contextBlock
  );
}

// ─── Plugin generation ────────────────────────────────────────────────────────

const PLUGIN_INTENT_RE =
  /\b(create|build|make|add|generate)\s+(a\s+)?(plugin|integration|connector)\s+(for|to|with)\s+(\w[\w\s]*)/i;

const PLUGIN_INTERFACE_PROMPT = `You are a code generator for Profession OS, a productivity dashboard.
Generate a JavaScript object literal (no import statements, no TypeScript syntax) that implements this interface:

{
  type: string,           // unique snake_case identifier, e.g. "jira"
  displayName: string,    // human-readable name
  description: string,    // one-sentence description
  icon: string,           // a lucide-react icon name, e.g. "CheckSquare"
  color: string,          // a CSS hex color
  configFields: Array<{   // fields shown in the Settings UI
    key: string,
    label: string,
    type: "text" | "password" | "number" | "select" | "checkbox",
    required: boolean,
    placeholder?: string,
    description?: string,
    options?: Array<{ label: string, value: string }>
  }>,
  poll: async function(config, credentials) {
    // Fetch items from the external service.
    // Return an array of ActivityItemData objects:
    // { externalId: string, itemType: string, title: string, urgency: 0|1|2,
    //   summary?: string, sourceUrl?: string, metadata: object, occurredAt?: Date }
    // Use fetch() for HTTP calls. Do not import anything.
    return [];
  },
  testConnection: async function(config, credentials) {
    // Return true if credentials are valid, false otherwise.
    return false;
  }
}

Rules:
- Output ONLY a single JavaScript object literal wrapped in a markdown code block (\`\`\`javascript ... \`\`\`)
- No import/require statements — use fetch() for HTTP
- No TypeScript syntax — plain JavaScript only
- The object must be self-contained and evaluable with Function()
- Use credentials for secrets (API keys, tokens), config for non-secret settings`;

function detectPluginIntent(message: string): string | null {
  const match = PLUGIN_INTENT_RE.exec(message);
  return match ? match[5].trim() : null;
}

function extractCodeBlock(text: string): string | null {
  const match = /```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/.exec(text);
  return match ? match[1].trim() : null;
}

async function generatePlugin(
  serviceName: string,
  apiKey: string,
  model: string,
  userId: string,
  conversationId: string,
  db: ReturnType<typeof import("@/db").getDb>
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: PLUGIN_INTERFACE_PROMPT,
    messages: [{ role: "user", content: `Create a plugin for ${serviceName}.` }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const code = extractCodeBlock(text);
  if (!code) {
    return `I wasn't able to generate valid plugin code for "${serviceName}". Please try again with a more specific service name.`;
  }

  // Quick sanity-check: the code must eval without throwing.
  try {
    // eslint-disable-next-line no-new-func
    new Function(`"use strict"; return (${code})`)();
  } catch {
    return `I generated code for "${serviceName}" but it contains a syntax error. Please try again.`;
  }

  // Derive type and name from the object if possible, fall back to serviceName.
  let pluginType = serviceName.toLowerCase().replace(/\s+/g, "_");
  let pluginName = serviceName;
  let pluginDescription = "";
  try {
    // eslint-disable-next-line no-new-func
    const obj = new Function(`"use strict"; return (${code})`)() as Record<string, unknown>;
    if (typeof obj.type === "string") pluginType = obj.type;
    if (typeof obj.displayName === "string") pluginName = obj.displayName;
    if (typeof obj.description === "string") pluginDescription = obj.description;
  } catch {
    // use defaults
  }

  await db.insert(customPlugins).values({
    userId,
    type: pluginType,
    name: pluginName,
    description: pluginDescription,
    code,
    enabled: true,
  });

  // Persist exchange in conversation.
  await db.insert(aiMessages).values({
    conversationId,
    role: "assistant",
    content: `Plugin created: **${pluginName}** (\`${pluginType}\`). It's now enabled and will appear in your next poll cycle. You can manage it in **Settings → Plugins**.`,
  });
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId));

  return `Plugin created: **${pluginName}** (\`${pluginType}\`). It's now enabled and will run on your next poll cycle. You can view and manage it in **Settings → Plugins**.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const incomingConversationId: string | undefined = body.conversationId;
  const lastUser = messages.findLast((m) => m.role === "user");

  const session = await safeAuth();
  const userId = session?.user?.id;

  if (userId) {
    const db = getDb();

    // Resolve or create conversation for all authenticated users.
    let conversationId = incomingConversationId;
    if (!conversationId) {
      const title = (lastUser?.content ?? "New conversation").slice(0, 80);
      const [newConv] = await db
        .insert(aiConversations)
        .values({ userId, title })
        .returning({ id: aiConversations.id });
      conversationId = newConv.id;
    }

    const [service] = await db
      .select()
      .from(connectedServices)
      .where(
        and(
          eq(connectedServices.userId, userId),
          eq(connectedServices.type, "claude_ai"),
          eq(connectedServices.enabled, true)
        )
      )
      .limit(1);

    if (service) {
      const config = service.config as Record<string, unknown>;
      const credentials = service.credentials as Record<string, unknown>;
      const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
      const model = (config.model as string) || "claude-sonnet-4-6";
      const limitRaw = config.contextItemLimit;
      const contextItemLimit =
        typeof limitRaw === "number" ? limitRaw : parseInt(String(limitRaw ?? "20")) || 20;

      if (apiKey) {
        // Persist the user message before streaming.
        if (lastUser) {
          await db.insert(aiMessages).values({
            conversationId,
            role: "user",
            content: lastUser.content,
          });
        }

        // Plugin generation intent — handle before normal streaming.
        const pluginTarget = lastUser ? detectPluginIntent(lastUser.content) : null;
        if (pluginTarget) {
          const reply = await generatePlugin(
            pluginTarget,
            apiKey,
            model,
            userId,
            conversationId,
            db
          );
          return simulatedStream(reply, conversationId);
        }

        // Load the user's top activity items for context.
        const activityRows = await db
          .select({
            itemType: activityItems.itemType,
            title: activityItems.title,
            urgency: activityItems.urgency,
            body: activityItems.body,
            occurredAt: activityItems.occurredAt,
          })
          .from(activityItems)
          .where(eq(activityItems.userId, userId))
          .orderBy(desc(activityItems.urgency), desc(activityItems.occurredAt))
          .limit(contextItemLimit);

        const systemPrompt = buildSystemPrompt(activityRows);
        const client = new Anthropic({ apiKey });

        const anthropicMessages = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const encoder = new TextEncoder();
        const capturedConversationId = conversationId;
        let assistantText = "";

        const stream = new ReadableStream({
          async start(controller) {
            const streamResponse = await client.messages.create({
              model,
              max_tokens: 1024,
              system: systemPrompt,
              messages: anthropicMessages,
              stream: true,
            });

            for await (const event of streamResponse) {
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                assistantText += event.delta.text;
                controller.enqueue(encoder.encode(event.delta.text));
              }
            }

            // Persist the assistant response and bump conversation updatedAt.
            if (assistantText) {
              await db.insert(aiMessages).values({
                conversationId: capturedConversationId,
                role: "assistant",
                content: assistantText,
              });
              await db
                .update(aiConversations)
                .set({ updatedAt: new Date() })
                .where(eq(aiConversations.id, capturedConversationId));
            }

            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Conversation-Id": capturedConversationId,
          },
        });
      }
    }

    // Authenticated but no claude-ai plugin — use simulated response and persist it.
    const responseText = pickResponse(lastUser?.content ?? "");
    const capturedConversationId = conversationId;
    const userContent = lastUser?.content ?? "";

    if (userContent) {
      await db.insert(aiMessages).values({ conversationId: capturedConversationId, role: "user", content: userContent });
    }
    // Persist assistant response after the simulated stream would finish.
    const estimatedDelay = responseText.split(" ").length * 45 + 200;
    setTimeout(() => {
      db.insert(aiMessages)
        .values({ conversationId: capturedConversationId, role: "assistant", content: responseText })
        .then(() =>
          db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, capturedConversationId))
        )
        .catch(console.error);
    }, estimatedDelay);

    return simulatedStream(responseText, capturedConversationId);
  }

  // Fallback: unauthenticated users — no persistence.
  const responseText = pickResponse(lastUser?.content ?? "");
  return simulatedStream(responseText);
}
