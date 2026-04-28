// Widget preferences API — read and write dashboard metric tile configuration.
// GET  /api/settings/widgets  — returns user's widget preferences (or defaults),
//                              with any available netsuite_* tiles merged in as
//                              disabled (opt-in) when the user has a connected
//                              NetSuite service with monitors configured.
// PATCH /api/settings/widgets  — saves widget preferences

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings, connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { DEFAULT_WIDGET_PREFS } from "@/lib/types";
import type { WidgetPreference, WidgetServiceKey } from "@/lib/types";

const BASE_KEYS: WidgetServiceKey[] = ["mail", "calendar", "messaging", "code", "crm"];

// Standard NetSuite monitor definitions — must stay in sync with
// services/plugins/netsuite-crm.ts STANDARD_MONITORS.
const NETSUITE_MONITORS: Array<{ configKey: string; key: string; label: string }> = [
  { configKey: "monitorPO",         key: "netsuite_po",          label: "Purchase Orders" },
  { configKey: "monitorRMA",        key: "netsuite_rma",         label: "Return Auth." },
  { configKey: "monitorVendorBill", key: "netsuite_vendor_bill", label: "Vendor Bills" },
  { configKey: "monitorSalesOrder", key: "netsuite_sales_order", label: "Sales Orders" },
];

/**
 * Build the list of available netsuite_* widget prefs from a connected service's
 * config. Standard monitors that are enabled in config get a fixed key; custom
 * monitors get a netsuite_custom_<recordType> key with the user-defined label.
 * All returned prefs have enabled=false (opt-in by default).
 */
function buildAvailableNetsuitePrefs(config: Record<string, unknown>): WidgetPreference[] {
  const prefs: WidgetPreference[] = [];

  for (const monitor of NETSUITE_MONITORS) {
    if (config[monitor.configKey]) {
      prefs.push({ key: monitor.key as WidgetServiceKey, enabled: false, label: monitor.label });
    }
  }

  for (let i = 1; i <= 3; i++) {
    const label      = config[`custom${i}Label`] as string | undefined;
    const recordType = config[`custom${i}RecordType`] as string | undefined;
    if (label && recordType) {
      prefs.push({
        key:     `netsuite_custom_${recordType}` as WidgetServiceKey,
        enabled: false,
        label,
      });
    }
  }

  return prefs;
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const db = getDb();

  let savedPrefs: WidgetPreference[];
  let nsService: { config: unknown } | undefined;

  try {
    const [row] = await db
      .select({ widgetPreferences: userSettings.widgetPreferences })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    savedPrefs = (row?.widgetPreferences as WidgetPreference[] | null) ?? DEFAULT_WIDGET_PREFS;

    // Fetch the user's enabled NetSuite service (if any) to determine available
    // netsuite_* tiles and merge them in as opt-in (disabled by default).
    [nsService] = await db
      .select({ config: connectedServices.config })
      .from(connectedServices)
      .where(
        and(
          eq(connectedServices.userId, userId),
          eq(connectedServices.enabled, true),
          eq(connectedServices.type, "netsuite_crm")
        )
      )
      .limit(1);
  } catch (err) {
    console.error("[GET /api/settings/widgets] DB error:", err);
    return Response.json(
      { error: "Failed to load widget preferences" },
      { status: 500 }
    );
  }

  const noStore = { "Cache-Control": "no-store" };

  if (!nsService) {
    return Response.json(savedPrefs, { headers: noStore });
  }

  const availableNetsuitePrefs = buildAvailableNetsuitePrefs(
    (nsService.config as Record<string, unknown>) ?? {}
  );

  if (availableNetsuitePrefs.length === 0) {
    return Response.json(savedPrefs, { headers: noStore });
  }

  // Merge: saved prefs take precedence (preserve enabled state + order);
  // any available netsuite_* tile not yet in saved prefs is appended as disabled.
  const savedKeys = new Set(savedPrefs.map((p) => p.key));
  const newPrefs = availableNetsuitePrefs.filter((p) => !savedKeys.has(p.key));
  return Response.json([...savedPrefs, ...newPrefs], { headers: noStore });
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) {
    return Response.json({ error: "Expected an array of widget preferences" }, { status: 400 });
  }

  let prefs: WidgetPreference[];
  try {
    prefs = body.map((item: unknown) => {
      if (typeof item !== "object" || item === null) throw new Error("Invalid item");
      const p = item as Record<string, unknown>;
      const key = p.key as string;

      const isBaseKey   = BASE_KEYS.includes(key as WidgetServiceKey);
      const isNetsuite  = /^netsuite_[a-zA-Z0-9_]+$/.test(key);
      if ((!isBaseKey && !isNetsuite) || typeof p.enabled !== "boolean") {
        throw new Error(`Invalid preference: ${JSON.stringify(item)}`);
      }

      const pref: WidgetPreference = { key: key as WidgetServiceKey, enabled: p.enabled };
      if (isNetsuite && typeof p.label === "string") pref.label = p.label;
      return pref;
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid preferences" },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    await db
      .insert(userSettings)
      .values({ userId: session.user.id, widgetPreferences: prefs })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { widgetPreferences: prefs },
      });
  } catch (err) {
    console.error("[PATCH /api/settings/widgets] DB error:", err);
    return Response.json(
      { error: "Failed to save widget preferences" },
      { status: 500 }
    );
  }

  return Response.json(prefs);
}
