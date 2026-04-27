// GET /api/metrics/[service]?range=24h|7d|30d
//
// Returns activity-history metrics for one dashboard tile.
// [service] must be one of the five base keys (mail, calendar, messaging, code,
// crm) OR a netsuite_* key (e.g. netsuite_po, netsuite_rma, netsuite_custom_*).
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
  getServiceTypes,
  getSecondaryLabel,
  RANGE_CONFIG,
  buildWidgetMetrics,
  type MetricsRange,
  type MetricsRow,
} from "@/lib/metrics";

const BASE_SERVICES = new Set<string>(["mail", "calendar", "messaging", "code", "crm"]);
const VALID_RANGES   = new Set<string>(["24h", "7d", "30d"]);

type Params = { service: string };

function isValidService(s: string): boolean {
  return BASE_SERVICES.has(s) || /^netsuite_[a-z0-9_]+$/.test(s);
}

export async function GET(req: Request, { params }: { params: Promise<Params> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { service: serviceParam } = await params;

  if (!isValidService(serviceParam)) {
    return Response.json(
      { error: `Invalid service key: ${serviceParam}` },
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
  const serviceTypes = getServiceTypes(service);
  const isNetsuite   = service.startsWith("netsuite_");

  // ── Empty response helper ────────────────────────────────────────────────────
  const emptyResponse = () =>
    Response.json({
      service,
      range,
      metric: 0,
      secondaryLabel: getSecondaryLabel(service),
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

  // For netsuite_* tiles, additionally filter by itemType so each tile only
  // counts its own monitor type (e.g. netsuite_po vs netsuite_vendor_bill).
  const netsuiteItemTypeFilter = isNetsuite
    ? eq(activityItems.itemType, service)
    : undefined;

  const currentRows: MetricsRow[] = await db
    .select(rowShape)
    .from(activityItems)
    .innerJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
    .where(
      and(
        eq(activityItems.userId, userId),
        gte(activityItems.createdAt, currentStart),
        inArray(connectedServices.type, serviceTypes),
        netsuiteItemTypeFilter
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
        inArray(connectedServices.type, serviceTypes),
        netsuiteItemTypeFilter
      )
    );

  const metrics = buildWidgetMetrics(service, range, currentRows, prevRows, true);
  return Response.json({ ...metrics, range });
}
