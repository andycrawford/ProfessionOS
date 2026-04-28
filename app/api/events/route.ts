// SSE endpoint — streams live dashboard events from real activityItems.
// On connect: emit the user's last 24h of activity (desc, limit 50) then
// send widget_update events for all 5 dashboard tiles with real metrics.
// Poll every 30s for new feed items AND refreshed widget metrics.
// Keep-alive comment ping every 20s to prevent Vercel 300s timeout (DVI-83).
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { activityItems, connectedServices } from "@/db/schema";
import { eq, and, gt, gte, lt, desc } from "drizzle-orm";
import type { SSEEvent, FeedItem, FeedService, FeedItemSeverity, WidgetServiceKey } from "@/lib/types";
import {
  getServiceTypes,
  RANGE_CONFIG,
  buildWidgetMetrics,
  type MetricsRow,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toFeedService(serviceType: string | null): FeedService {
  switch (serviceType) {
    case "ms365_email":
      return "mail";
    case "ms365_calendar":
    case "google_calendar":
      return "calendar";
    case "clickup":
    case "ziflow":
      return "code";
    case "netsuite_invoices":
    case "netsuite_rma":
      return "crm";
    case "claude_ai":
      return "ai";
    default:
      return "mail";
  }
}

function toSeverity(urgency: number): FeedItemSeverity {
  if (urgency >= 2) return "critical";
  if (urgency === 1) return "warning";
  return "info";
}

function formatTime(date: Date | null): string {
  return (date ?? new Date()).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toFeedItem(
  item: typeof activityItems.$inferSelect,
  serviceType: string | null
): FeedItem {
  const meta = item.metadata as Record<string, unknown> | null;
  // Derive Teams join URL. New records store onlineMeetingUrl in metadata directly.
  // Fall back to sourceUrl for older records polled before that field was added —
  // in those cases sourceUrl was set to the Teams URL when no webLink was available.
  let joinUrl: string | undefined;
  if (meta?.isOnlineMeeting) {
    if (typeof meta.onlineMeetingUrl === "string") {
      joinUrl = meta.onlineMeetingUrl;
    } else if (item.sourceUrl?.includes("teams.microsoft.com")) {
      joinUrl = item.sourceUrl;
    }
  }

  return {
    id: item.id,
    severity: toSeverity(item.urgency),
    service: toFeedService(serviceType),
    title: item.title,
    subtitle: item.body ?? undefined,
    timestamp: formatTime(item.occurredAt ?? item.createdAt),
    sourceUrl: item.sourceUrl ?? undefined,
    joinUrl,
  };
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
}

// ─── Widget metrics helper ────────────────────────────────────────────────────
// Computes real WidgetMetrics for all 5 dashboard tiles using the 24h window.
// Falls back gracefully: services with no connected adapter return state:"empty".

const ALL_WIDGET_KEYS: WidgetServiceKey[] = ["mail", "calendar", "messaging", "code", "crm"];

async function fetchAllWidgetMetrics(userId: string): Promise<SSEEvent[]> {
  const db = getDb();
  const range = "24h" as const;
  const { buckets, bucketMs } = RANGE_CONFIG[range];
  const windowMs     = buckets * bucketMs;
  const now          = Date.now();
  const currentStart = new Date(now - windowMs);
  const prevStart    = new Date(now - 2 * windowMs);

  const rowShape = {
    serviceId:  activityItems.serviceId,
    occurredAt: activityItems.occurredAt,
    createdAt:  activityItems.createdAt,
    urgency:    activityItems.urgency,
  };

  // Fetch current-period rows for all services in one query, joined to get type
  let currentAll: (MetricsRow & { serviceType: string | null })[] = [];
  let prevAll:    (MetricsRow & { serviceType: string | null })[] = [];
  try {
    currentAll = await db
      .select({ ...rowShape, serviceType: connectedServices.type })
      .from(activityItems)
      .innerJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
      .where(
        and(
          eq(activityItems.userId, userId),
          gte(activityItems.createdAt, currentStart)
        )
      );

    prevAll = await db
      .select({ ...rowShape, serviceType: connectedServices.type })
      .from(activityItems)
      .innerJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
      .where(
        and(
          eq(activityItems.userId, userId),
          gte(activityItems.createdAt, prevStart),
          lt(activityItems.createdAt, currentStart)
        )
      );
  } catch {
    // DB error — return empty metrics for all tiles rather than dropping the stream
    return ALL_WIDGET_KEYS.map((service) => ({
      type: "widget_update" as const,
      payload: buildWidgetMetrics(service, range, [], [], false),
    }));
  }

  // Check which service types the user actually has connected
  let connectedTypes: Set<string> = new Set();
  try {
    const rows = await db
      .select({ type: connectedServices.type })
      .from(connectedServices)
      .where(
        and(
          eq(connectedServices.userId, userId),
          eq(connectedServices.enabled, true)
        )
      );
    connectedTypes = new Set(rows.map((r) => r.type));
  } catch {
    // Leave connectedTypes empty — all widgets will show as empty
  }

  return ALL_WIDGET_KEYS.map((service) => {
    const types = getServiceTypes(service);
    const hasConnected = types.length > 0 && types.some((t) => connectedTypes.has(t));
    const currentRows: MetricsRow[] = currentAll.filter(
      (r) => r.serviceType !== null && types.includes(r.serviceType)
    );
    const prevRows: MetricsRow[] = prevAll.filter(
      (r) => r.serviceType !== null && types.includes(r.serviceType)
    );
    return {
      type: "widget_update" as const,
      payload: buildWidgetMetrics(service, range, currentRows, prevRows, hasConnected),
    };
  });
}

// ─── Demo stream (unauthenticated) ───────────────────────────────────────────
// Emits realistic feed_item and widget_update events so the demo dashboard
// shows a populated, live-looking state without a real database or session.

function fmtTime(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const DEMO_FEED_INITIAL: SSEEvent[] = [
  { type: "feed_item", payload: { id: "d1", severity: "critical", service: "mail", title: "Urgent: Q2 contract renewal from Apex Corp", subtitle: "Deadline is end of day — requires your signature", timestamp: fmtTime(2 * 60000) } },
  { type: "feed_item", payload: { id: "d2", severity: "warning", service: "calendar", title: "All-hands in 15 minutes", subtitle: "Room 3B — agenda attached", timestamp: fmtTime(5 * 60000) } },
  { type: "feed_item", payload: { id: "d3", severity: "info",     service: "code",     title: "PR #412 merged: Auth token refresh", subtitle: "Merged by Sam Rivera · 3 checks passed", timestamp: fmtTime(12 * 60000) } },
  { type: "feed_item", payload: { id: "d4", severity: "info",     service: "crm",      title: "Opportunity updated: Horizon Deal ($84k)", subtitle: "Stage moved to Proposal → Negotiation", timestamp: fmtTime(18 * 60000) } },
  { type: "feed_item", payload: { id: "d5", severity: "warning",  service: "mail",     title: "3 emails flagged for follow-up", subtitle: "Overdue: Lena Park, James Wu, + 1 more", timestamp: fmtTime(25 * 60000) } },
  { type: "feed_item", payload: { id: "d6", severity: "info",     service: "messaging", title: "New message from Jordan (Design)", subtitle: "\"Can you review the mock before the 2pm call?\"", timestamp: fmtTime(31 * 60000) } },
  { type: "feed_item", payload: { id: "d7", severity: "info",     service: "code",     title: "CI passed on main · build #1088", subtitle: "Deploy to staging queued", timestamp: fmtTime(44 * 60000) } },
  { type: "feed_item", payload: { id: "d8", severity: "info",     service: "crm",      title: "Contact created: Priya Nair (Nexus Labs)", subtitle: "Source: LinkedIn import", timestamp: fmtTime(58 * 60000) } },
];

// Rotating pool of feed items emitted every 30s to simulate live activity
const DEMO_FEED_LIVE: Omit<FeedItem, "timestamp">[] = [
  { id: "dl1", severity: "info",    service: "mail",      title: "Reply from Apex Corp received",          subtitle: "\"We're aligned — sending docs now\""  },
  { id: "dl2", severity: "warning", service: "code",      title: "Build #1089 failed on feat/payments",    subtitle: "1 test failure in checkout flow"         },
  { id: "dl3", severity: "info",    service: "calendar",  title: "Meeting ended: All-hands (43 min)",      subtitle: "Recording available in 10 minutes"       },
  { id: "dl4", severity: "info",    service: "crm",       title: "Task completed: Follow up with Horizon", subtitle: "Marked done by AI assistant"             },
  { id: "dl5", severity: "info",    service: "messaging", title: "Jordan replied to your message",         subtitle: "\"Looks great — approved!\""             },
];

const DEMO_WIDGETS: SSEEvent[] = [
  { type: "widget_update", payload: { service: "mail",      metric: 47,  secondaryLabel: "new emails",      deltaPercent: 18,  sparkline: [28,32,29,35,38,31,40,44,39,43,47,47], state: "default" } },
  { type: "widget_update", payload: { service: "calendar",  metric: 8,   secondaryLabel: "events today",    deltaPercent: -8,  sparkline: [6,9,7,8,10,9,8,7,9,8,9,8],  state: "warning",  alertCount: 2 } },
  { type: "widget_update", payload: { service: "messaging", metric: 124, secondaryLabel: "unread messages", deltaPercent: 5,   sparkline: [95,102,110,98,115,108,119,122,116,121,124,124], state: "default" } },
  { type: "widget_update", payload: { service: "code",      metric: 11,  secondaryLabel: "open PRs",        deltaPercent: 22,  sparkline: [5,7,6,8,7,9,8,10,9,11,10,11], state: "default" } },
  { type: "widget_update", payload: { service: "crm",       metric: 5,   secondaryLabel: "deals updated",   deltaPercent: 0,   sparkline: [3,4,3,5,4,6,5,4,5,5,5,5],    state: "default" } },
];

function demoStream(): Response {
  const encoder = new TextEncoder();
  let liveTimer: ReturnType<typeof setInterval>;
  let keepaliveTimer: ReturnType<typeof setInterval>;
  let liveIndex = 0;

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: SSEEvent) =>
        controller.enqueue(encoder.encode(formatSSE(event)));

      // Initial ping
      enqueue({ type: "ping", payload: { ts: Date.now() } });

      // Emit initial feed and widget data
      for (const event of DEMO_FEED_INITIAL) enqueue(event);
      for (const event of DEMO_WIDGETS) enqueue(event);

      // Rotate through live events every 30s
      liveTimer = setInterval(() => {
        const base = DEMO_FEED_LIVE[liveIndex % DEMO_FEED_LIVE.length];
        enqueue({ type: "feed_item", payload: { ...base, timestamp: fmtTime() } });
        liveIndex++;
      }, 30_000);

      // Keepalive comment every 20s
      keepaliveTimer = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        20_000
      );
    },
    cancel() {
      clearInterval(liveTimer);
      clearInterval(keepaliveTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return demoStream();
  }

  const userId = session.user.id;
  const db = getDb();
  const encoder = new TextEncoder();

  // Cursor: tracks the most recent createdAt we've sent.
  // Initialised to now so the initial load uses a fixed 24h window, and
  // subsequent polls only return items that arrived after connection time.
  let cursor = new Date();

  let pollTimer: ReturnType<typeof setTimeout>;
  let pingTimer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SSEEvent) =>
        controller.enqueue(encoder.encode(formatSSE(event)));

      // SSE comment pings prevent the Vercel 300s timeout
      const keepalive = () =>
        controller.enqueue(encoder.encode(": keepalive\n\n"));

      // Initial ping on connect
      enqueue({ type: "ping", payload: { ts: Date.now() } });

      // Load last 24h of activity items on connect
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const rows = await db
          .select({
            item: activityItems,
            serviceType: connectedServices.type,
          })
          .from(activityItems)
          .leftJoin(
            connectedServices,
            eq(activityItems.serviceId, connectedServices.id)
          )
          .where(
            and(
              eq(activityItems.userId, userId),
              gt(activityItems.createdAt, since)
            )
          )
          .orderBy(desc(activityItems.createdAt))
          .limit(50);

        for (const { item, serviceType } of rows) {
          enqueue({ type: "feed_item", payload: toFeedItem(item, serviceType) });
        }

        // Advance cursor to the most recent item sent (rows ordered desc)
        if (rows.length > 0) {
          cursor = rows[0].item.createdAt;
        }
      } catch {
        // DB unavailable at connect — continue; polling will retry
      }

      // Emit initial widget metrics for all 5 dashboard tiles
      try {
        const widgetEvents = await fetchAllWidgetMetrics(userId);
        for (const event of widgetEvents) enqueue(event);
      } catch {
        // Non-fatal — dashboard will show loading/empty state
      }

      // Poll every 30s for items newer than the cursor
      const schedulePoll = () => {
        pollTimer = setTimeout(async () => {
          try {
            const snapshot = cursor; // capture before await
            const rows = await db
              .select({
                item: activityItems,
                serviceType: connectedServices.type,
              })
              .from(activityItems)
              .leftJoin(
                connectedServices,
                eq(activityItems.serviceId, connectedServices.id)
              )
              .where(
                and(
                  eq(activityItems.userId, userId),
                  gt(activityItems.createdAt, snapshot)
                )
              )
              .orderBy(desc(activityItems.createdAt))
              .limit(50);

            for (const { item, serviceType } of rows) {
              enqueue({
                type: "feed_item",
                payload: toFeedItem(item, serviceType),
              });
            }

            if (rows.length > 0) {
              cursor = rows[0].item.createdAt;
            }
          } catch {
            // DB error — skip this poll cycle
          }

          // Refresh widget metrics after each feed poll so sparklines stay current
          try {
            const widgetEvents = await fetchAllWidgetMetrics(userId);
            for (const event of widgetEvents) enqueue(event);
          } catch {
            // Non-fatal — skip widget refresh for this cycle
          }

          schedulePoll();
        }, 30_000);
      };

      schedulePoll();

      // Keep-alive comment every 20s
      pingTimer = setInterval(keepalive, 20_000);
    },

    cancel() {
      clearTimeout(pollTimer);
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
