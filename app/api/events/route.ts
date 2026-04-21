// SSE endpoint — streams live dashboard events to the client.
// Each connected client gets its own independent event generator.
import type { SSEEvent, FeedItem, Alert, WidgetMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Simulated event pools ────────────────────────────────────────────────────

const FEED_POOL: Omit<FeedItem, "id" | "timestamp">[] = [
  {
    severity: "info",
    service: "code",
    title: "PR #217 merged: refactor auth middleware",
    subtitle: "ProfessionOS · main ← feature/auth-refactor · +142 −89",
  },
  {
    severity: "neutral",
    service: "slack",
    title: "#design: new mockups posted for review",
    subtitle: "Figma link shared — 3 screens, mobile + desktop variants",
  },
  {
    severity: "warning",
    service: "calendar",
    title: "Meeting starts in 10 minutes: Product roadmap sync",
    subtitle: "Google Meet · 8 attendees · recurring weekly",
  },
  {
    severity: "info",
    service: "mail",
    title: "Invoice #1084 approved by Finance",
    subtitle: "Amount: $4,800 · Vendor: AWS · Due: 2026-05-01",
  },
  {
    severity: "neutral",
    service: "crm",
    title: "Deal stage updated: Acme Corp → Proposal Sent",
    subtitle: "Sales pipeline · $120k ARR · Owner: Jamie",
  },
  {
    severity: "critical",
    service: "code",
    title: "Error rate spike on /api/checkout — 12% failure rate",
    subtitle: "Sentry · P0 · Affecting 43 users in the last 5 min",
  },
  {
    severity: "info",
    service: "slack",
    title: "#eng-infra: DB migration completed successfully",
    subtitle: "PostgreSQL 15.4 → 16.1 · Zero downtime · 4.2GB migrated",
  },
  {
    severity: "info",
    service: "ai",
    title: "AI summary ready: 12 unread emails categorised",
    subtitle: "3 action required · 5 FYI · 4 newsletters",
  },
  {
    severity: "warning",
    service: "mail",
    title: "SLA breach risk: ticket #8821 approaching 4h mark",
    subtitle: "Support · Customer: Globex Inc · Priority: High",
  },
  {
    severity: "neutral",
    service: "code",
    title: "Scheduled job completed: nightly data export",
    subtitle: "Ran in 1m 42s · 18,432 rows exported to S3",
  },
];

const WIDGET_POOL: WidgetMetrics[] = [
  {
    service: "mail",
    metric: 131,
    secondaryLabel: "new messages",
    deltaPercent: 22,
    sparkline: [42, 58, 51, 73, 60, 88, 95, 112, 131],
    state: "default",
  },
  {
    service: "code",
    metric: 13,
    secondaryLabel: "open PRs",
    deltaPercent: 30,
    sparkline: [3, 5, 4, 7, 6, 8, 5, 9, 13],
    state: "default",
  },
  {
    service: "slack",
    metric: 261,
    secondaryLabel: "unread messages",
    deltaPercent: -3,
    sparkline: [210, 190, 225, 205, 230, 215, 240, 220, 261],
    state: "default",
  },
  {
    service: "code",
    metric: 9,
    secondaryLabel: "open PRs",
    deltaPercent: -18,
    sparkline: [11, 10, 13, 12, 11, 10, 9, 10, 9],
    state: "warning",
    alertCount: 2,
  },
  {
    service: "crm",
    metric: 7,
    secondaryLabel: "follow-ups due",
    deltaPercent: 40,
    sparkline: [2, 3, 2, 4, 3, 5, 4, 6, 7],
    state: "warning",
    alertCount: 1,
  },
];

const ALERT_POOL: Alert[] = [
  {
    id: "",
    severity: "critical",
    service: "Code",
    summary: "Error rate spike on /api/checkout — immediate investigation needed",
  },
  {
    id: "",
    severity: "warning",
    service: "Calendar",
    summary: "4 scheduling conflicts detected for Friday — review required",
  },
  {
    id: "",
    severity: "info",
    service: "Mail",
    summary: "Q2 board report shared by Finance — review by EOD requested",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export function GET() {
  const encoder = new TextEncoder();
  let feedIndex = Math.floor(Math.random() * FEED_POOL.length);
  let widgetIndex = Math.floor(Math.random() * WIDGET_POOL.length);
  let alertIndex = 0;

  let feedTimer: ReturnType<typeof setTimeout>;
  let widgetTimer: ReturnType<typeof setTimeout>;
  let alertTimer: ReturnType<typeof setTimeout>;
  let pingTimer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: SSEEvent) =>
        controller.enqueue(encoder.encode(formatSSE(event)));

      // Initial ping on connect
      enqueue({ type: "ping", payload: { ts: Date.now() } });

      // Feed item — first one after 8s, then randomised 10–18s
      const scheduleFeed = () => {
        const delay = 10_000 + Math.random() * 8_000;
        feedTimer = setTimeout(() => {
          const template = pick(FEED_POOL, feedIndex++);
          enqueue({
            type: "feed_item",
            payload: { ...template, id: `live-${uid()}`, timestamp: now() },
          });
          scheduleFeed();
        }, delay);
      };
      feedTimer = setTimeout(scheduleFeed, 8_000);

      // Widget update every 20s
      const scheduleWidget = () => {
        widgetTimer = setTimeout(() => {
          enqueue({
            type: "widget_update",
            payload: { ...pick(WIDGET_POOL, widgetIndex++) },
          });
          scheduleWidget();
        }, 20_000);
      };
      scheduleWidget();

      // Rare alert — first after 35s, then 60s
      const scheduleAlert = () => {
        alertTimer = setTimeout(() => {
          if (alertIndex < ALERT_POOL.length) {
            const template = pick(ALERT_POOL, alertIndex++);
            enqueue({
              type: "alert",
              payload: { ...template, id: `alert-${uid()}` },
            });
          }
          scheduleAlert();
        }, 60_000);
      };
      alertTimer = setTimeout(scheduleAlert, 35_000);

      // Keepalive ping every 25s
      pingTimer = setInterval(() => {
        enqueue({ type: "ping", payload: { ts: Date.now() } });
      }, 25_000);
    },

    cancel() {
      clearTimeout(feedTimer);
      clearTimeout(widgetTimer);
      clearTimeout(alertTimer);
      clearInterval(pingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable nginx/proxy buffering so events flush immediately
      "X-Accel-Buffering": "no",
    },
  });
}
