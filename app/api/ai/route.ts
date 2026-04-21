// AI chat endpoint — streams a simulated assistant response word-by-word.
// Replace the response generator with a real LLM call when integrating a model.

export const dynamic = "force-dynamic";

// ─── Response pool ────────────────────────────────────────────────────────────

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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: { role: string; content: string }[] = body.messages ?? [];
  const lastUser = messages.findLast((m) => m.role === "user");
  const responseText = pickResponse(lastUser?.content ?? "");

  const encoder = new TextEncoder();
  // Stream word by word with a short delay to simulate typing
  const words = responseText.split(" ");

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < words.length; i++) {
        // Append space after each word except the last
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
