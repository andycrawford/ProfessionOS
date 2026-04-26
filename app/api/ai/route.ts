// AI chat endpoint — streams a real Claude response when the user has a claude-ai
// connectedService configured; falls back to a simulated word-by-word response otherwise.
// Persists conversations and messages to the DB when the user is authenticated.

export const dynamic = "force-dynamic";

import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems, aiConversations, aiMessages } from "@/db/schema";
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
  slack:
    "You're mentioned 7 times across #eng, #product, and #design. The highest-priority thread is the checkout error in #eng — the team is investigating and expects a root-cause in ~30 minutes.",
  error:
    "The /api/checkout error spike started at 09:47 and is now at 12% failure rate. Sentry trace shows a null-pointer in the PaymentService.processCard method — looks like a null customer ID on guest checkout. Do you want me to surface the relevant code diff?",
  summary:
    "Here's your morning summary: 131 emails (3 need replies), 13 calendar events today (3 conflicts on Thursday), 261 Slack unread (7 direct mentions), and 1 active P0 incident on /api/checkout. Overall risk level: elevated. I recommend addressing the checkout error first.",
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
    return RESPONSES.slack;
  }
  if (lower.includes("error") || lower.includes("spike") || lower.includes("checkout")) {
    return RESPONSES.error;
  }
  if (lower.includes("summary") || lower.includes("status") || lower.includes("today")) {
    return RESPONSES.summary;
  }
  return RESPONSES.default;
}

function simulatedStream(text: string): Response {
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
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const incomingConversationId: string | undefined = body.conversationId;
  const lastUser = messages.findLast((m) => m.role === "user");

  const session = await auth();
  const userId = session?.user?.id;

  if (userId) {
    const db = getDb();
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
        // Resolve or create the conversation record.
        let conversationId = incomingConversationId;
        if (!conversationId) {
          const title = (lastUser?.content ?? "New conversation").slice(0, 80);
          const [newConv] = await db
            .insert(aiConversations)
            .values({ userId, title })
            .returning({ id: aiConversations.id });
          conversationId = newConv.id;
        }

        // Persist the user message.
        if (lastUser && conversationId) {
          await db.insert(aiMessages).values({
            conversationId,
            role: "user",
            content: lastUser.content,
          });
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
            if (capturedConversationId && assistantText) {
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
            "X-Conversation-Id": capturedConversationId ?? "",
          },
        });
      }
    }
  }

  // Fallback: simulated response for unauthenticated users or those without a claude-ai plugin.
  const responseText = pickResponse(lastUser?.content ?? "");
  return simulatedStream(responseText);
}
