/**
 * lib/metrics.ts — Activity history data service for dashboard sparklines.
 *
 * Data contract
 * ─────────────
 * Sparkline generation
 *   Activity items are bucketed into N equal time slices over the requested
 *   range ("24h" → 24 hourly buckets, "7d" → 7 daily, "30d" → 30 daily).
 *   Each bucket counts items whose occurredAt (or createdAt as fallback) falls
 *   within that slice, measured from the start of the current period window.
 *
 * deltaPercent
 *   The item count in the current period is compared against an identical-
 *   length period immediately preceding it.
 *   Formula: round(((current − previous) / max(previous, 1)) × 100)
 *   Returns 0 when both periods are empty.
 *
 * Disconnected service
 *   When the user has no enabled connected service for the requested widget
 *   key, the response returns state: "empty", metric: 0, deltaPercent: 0, and
 *   a flat sparkline of zeros. "messaging" always returns empty because no DB
 *   service type maps to it yet.
 */

import type { WidgetServiceKey, BaseWidgetServiceKey, WidgetMetrics, WidgetState } from "@/lib/types";

// ─── Service type mapping ─────────────────────────────────────────────────────

/**
 * Maps each static dashboard widget key to the DB connectedServices.type values
 * it aggregates. An empty array means no service type exists yet (always empty).
 * netsuite_* keys are handled dynamically via getServiceTypes().
 */
export const WIDGET_SERVICE_TYPES: Record<BaseWidgetServiceKey, string[]> = {
  mail:     ["ms365_email"],
  calendar: ["ms365_calendar", "google_calendar"],
  messaging: [], // no service type mapped yet
  code:     ["clickup", "ziflow"],
  crm:      ["netsuite_invoices", "netsuite_rma"],
};

/**
 * Returns the connectedServices.type values to check for a given widget key.
 * All netsuite_* tiles share the same "netsuite_crm" service type — they
 * differ by activityItems.itemType rather than service type.
 */
export function getServiceTypes(key: WidgetServiceKey): string[] {
  if (key.startsWith("netsuite_")) return ["netsuite_crm"];
  return WIDGET_SERVICE_TYPES[key as BaseWidgetServiceKey] ?? [];
}

// Display labels for the known netsuite_* item types
const NETSUITE_KEY_LABELS: Record<string, string> = {
  netsuite_po:           "Purchase Orders",
  netsuite_rma:          "Return Auth.",
  netsuite_vendor_bill:  "Vendor Bills",
  netsuite_sales_order:  "Sales Orders",
};

/**
 * Returns a human-readable label for a netsuite_* widget key.
 * Falls back to normalising the record type suffix for unknown/custom keys.
 */
export function netsuiteKeyLabel(key: string): string {
  if (key in NETSUITE_KEY_LABELS) return NETSUITE_KEY_LABELS[key];
  // e.g. "netsuite_custom_expenseReport" → "Expense Report"
  const suffix = key.replace(/^netsuite_custom_/, "").replace(/^netsuite_/, "");
  return suffix.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim() || key;
}

// ─── Range configuration ──────────────────────────────────────────────────────

export type MetricsRange = "24h" | "7d" | "30d";

/**
 * Defines the number of sparkline data points and the duration of each bucket
 * in milliseconds for each supported range.
 */
export const RANGE_CONFIG: Record<MetricsRange, { buckets: number; bucketMs: number }> = {
  "24h": { buckets: 24, bucketMs:      60 * 60 * 1000 }, // 1-hour  buckets
  "7d":  { buckets:  7, bucketMs: 24 * 60 * 60 * 1000 }, // 1-day   buckets
  "30d": { buckets: 30, bucketMs: 24 * 60 * 60 * 1000 }, // 1-day   buckets
};

const SECONDARY_LABELS: Record<BaseWidgetServiceKey, string> = {
  mail:     "emails",
  calendar: "events",
  messaging: "messages",
  code:     "tasks",
  crm:      "follow-ups",
};

/**
 * Returns the secondary count label for a widget tile.
 * netsuite_* tiles always use "pending items".
 */
export function getSecondaryLabel(key: WidgetServiceKey): string {
  if (key.startsWith("netsuite_")) return "pending items";
  return SECONDARY_LABELS[key as BaseWidgetServiceKey] ?? "items";
}

// ─── Core computation ─────────────────────────────────────────────────────────

export type MetricsRow = {
  occurredAt: Date | null;
  createdAt: Date;
  urgency: number;
};

/**
 * Build a sparkline array from a list of item timestamps.
 *
 * Items whose effective timestamp falls before windowStart, or at/after
 * windowStart + buckets × bucketMs, are silently ignored.
 */
export function buildSparkline(
  timestamps: Date[],
  windowStart: Date,
  buckets: number,
  bucketMs: number,
): number[] {
  const counts = new Array<number>(buckets).fill(0);
  const origin = windowStart.getTime();
  for (const ts of timestamps) {
    const idx = Math.floor((ts.getTime() - origin) / bucketMs);
    if (idx >= 0 && idx < buckets) counts[idx]++;
  }
  return counts;
}

/**
 * Compute percentage change from previous to current count.
 * Returns 0 when previous is 0 to avoid division by zero.
 */
export function computeDeltaPercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Build a complete WidgetMetrics payload from pre-fetched DB rows.
 *
 * @param service         Dashboard widget key.
 * @param range           Requested time range.
 * @param currentRows     Items in the current period.
 * @param prevRows        Items in the immediately preceding period (same length).
 * @param hasConnectedSvc Whether at least one enabled service is connected.
 */
export function buildWidgetMetrics(
  service: WidgetServiceKey,
  range: MetricsRange,
  currentRows: MetricsRow[],
  prevRows: MetricsRow[],
  hasConnectedSvc: boolean,
): WidgetMetrics {
  const { buckets, bucketMs } = RANGE_CONFIG[range];
  const windowMs    = buckets * bucketMs;
  const windowStart = new Date(Date.now() - windowMs);

  const timestamps   = currentRows.map((r) => r.occurredAt ?? r.createdAt);
  const sparkline    = buildSparkline(timestamps, windowStart, buckets, bucketMs);
  const metric       = currentRows.length;
  const deltaPercent = computeDeltaPercent(metric, prevRows.length);

  const maxUrgency = currentRows.reduce((m, r) => Math.max(m, r.urgency), 0);
  const alertCount  = currentRows.filter((r) => r.urgency >= 1).length;

  let state: WidgetState = "default";
  if (!hasConnectedSvc)   state = "empty";
  else if (maxUrgency >= 2) state = "critical";
  else if (maxUrgency >= 1) state = "warning";

  return {
    service,
    metric,
    secondaryLabel: getSecondaryLabel(service),
    deltaPercent,
    sparkline,
    state,
    alertCount: alertCount > 0 ? alertCount : undefined,
  };
}
