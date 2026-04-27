// GET /api/metrics/[service]?range=24h|7d|30d
//
// Returns activity-history metrics for one dashboard tile.
// [service] must be one of: mail, calendar, messaging, code, crm.
// Falls back to range=24h when the query param is omitted.
//
// Response shape extends WidgetMetrics (lib/types.ts) with two extra fields:
//   service: WidgetServiceKey   — echoes the requested service
//   range:   MetricsRange       — echoes the effective range

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { activityItems, connectedServices } from "@/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import type { WidgetServiceKey } from "@/lib/types";
import {
  WIDGET_SERVICE_TYPES,
  RANGE_CONFIG,
  buildWidgetMetrics,
  type MetricsRange,
  type MetricsRow,
} from "@/lib/metrics";

const VALID_SERVICES = new Set<string>(["mail", "calendar", "messaging", "code", "crm"]);
const VALID_RANGES   = new Set<string>(["24h", "7d", "30d"]);

type Params = { service: string };

export async function GET(req: Request, { params }: { params: Promise<Params> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service: serviceParam } = await params;

  if (!VALID_SERVICES.has(serviceParam)) {
    return Response.json(
      { error: `Invalid service. Must be one of: ${[...VALID_SERVICES].join(", ")}` },
      { status: 400 }
    );
  }
  const service = serviceParam as WidgetServiceKey;

  const url        = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "24h";
  if (!VALID_RANGES.has(rangeParam)) {
    return Response.json(
      { error: `Invalid range. Must be one of: ${[...VALID_RANGES].join(", ")}` },
      { status: 400 }
    );
  }
  const range = rangeParam as MetricsRange;

  const { buckets, bucketMs } = RANGE_CONFIG[range];
  const windowMs     = buckets * bucketMs;
  const now          = Date.now();
  const currentStart = new Date(now - windowMs);
  const prevStart    = new Date(now - 2 * windowMs);

  const userId       = session.user.id;
  const serviceTypes = WIDGET_SERVICE_TYPES[service];

  // ── Empty response helper ────────────────────────────────────────────────────
  const emptyResponse = () =>
    Response.json({
      service,
      range,
      metric: 0,
      secondaryLabel:
        { mail: "emails", calendar: "events", messaging: "messages", code: "tasks", crm: "follow-ups" }[service],
      deltaPercent: 0,
      sparkline: new Array(buckets).fill(0),
      state: "empty",
    });

  // No DB service types mapped to this widget (e.g. "messaging") → always empty
  if (serviceTypes.length === 0) return emptyResponse();

  const db = getDb();

  // ── Check for at least one enabled connected service ─────────────────────────
  const connectedCheck = await db
    .select({ id: connectedServices.id })
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, userId),
        eq(connectedServices.enabled, true),
        inArray(connectedServices.type, serviceTypes)
      )
    )
    .limit(1);

  if (connectedCheck.length === 0) return emptyResponse();

  // ── Fetch current-period rows ────────────────────────────────────────────────
  const rowShape = {
    occurredAt: activityItems.occurredAt,
    createdAt:  activityItems.createdAt,
    urgency:    activityItems.urgency,
  };

  const currentRows: MetricsRow[] = await db
    .select(rowShape)
    .from(activityItems)
    .innerJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
    .where(
      and(
        eq(activityItems.userId, userId),
        gte(activityItems.createdAt, currentStart),
        inArray(connectedServices.type, serviceTypes)
      )
    );

  // ── Fetch previous-period rows (for delta) ───────────────────────────────────
  const prevRows: MetricsRow[] = await db
    .select(rowShape)
    .from(activityItems)
    .innerJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
    .where(
      and(
        eq(activityItems.userId, userId),
        gte(activityItems.createdAt, prevStart),
        lt(activityItems.createdAt, currentStart),
        inArray(connectedServices.type, serviceTypes)
      )
    );

  const metrics = buildWidgetMetrics(service, range, currentRows, prevRows, true);
  return Response.json({ ...metrics, range });
}
