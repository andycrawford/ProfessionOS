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
  return {
    id: item.id,
    severity: toSeverity(item.urgency),
    service: toFeedService(serviceType),
    title: item.title,
    subtitle: item.body ?? undefined,
    timestamp: formatTime(item.occurredAt ?? item.createdAt),
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
// When no session is present (e.g. demo.professionos.com), return an open SSE
// stream that sends an initial ping and periodic keepalive comments. The
// dashboard already renders INITIAL_FEED from local state, so no feed_item
// events are needed here — we just need the connection to succeed so the
// "Reconnecting…" banner stays hidden.

function demoPingStream(): Response {
  const encoder = new TextEncoder();
  let pingTimer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`)
      );
      pingTimer = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        20_000
      );
    },
    cancel() {
      clearInterval(pingTimer);
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
    return demoPingStream();
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
