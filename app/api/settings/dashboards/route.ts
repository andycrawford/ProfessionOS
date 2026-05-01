// Dashboards API — multi-dashboard configuration.
// GET  /api/settings/dashboards — returns user's dashboards array
// PATCH /api/settings/dashboards — saves dashboards array
//
// On first load, migrates legacy `dashboardWidgets` into a single "Home" dashboard.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Dashboard, DashboardWidget } from "@/lib/types";

function makeHomeDashboard(widgets: DashboardWidget[]): Dashboard {
  return {
    id: crypto.randomUUID(),
    name: "Home",
    isDefault: true,
    widgets,
  };
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  try {
    const [row] = await db
      .select({
        dashboards: userSettings.dashboards,
        dashboardWidgets: userSettings.dashboardWidgets,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id));

    // Already migrated
    if (row?.dashboards && Array.isArray(row.dashboards)) {
      return Response.json(row.dashboards as Dashboard[], {
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Migrate from legacy dashboardWidgets → single Home dashboard
    const legacyWidgets =
      (row?.dashboardWidgets as DashboardWidget[] | null) ?? [];
    const home = makeHomeDashboard(legacyWidgets);
    const dashboards: Dashboard[] = [home];

    // Persist the migration
    if (row) {
      await db
        .update(userSettings)
        .set({ dashboards })
        .where(eq(userSettings.userId, session.user.id));
    }

    return Response.json(dashboards, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/settings/dashboards] DB error:", err);
    return Response.json(
      { error: "Failed to load dashboards" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body) || body.length === 0) {
    return Response.json(
      { error: "Expected a non-empty array of dashboards" },
      { status: 400 },
    );
  }

  // Light validation
  let dashboards: Dashboard[];
  try {
    dashboards = body.map((item: unknown) => {
      const d = item as Record<string, unknown>;
      if (
        typeof d.id !== "string" ||
        typeof d.name !== "string" ||
        d.name.trim().length === 0 ||
        typeof d.isDefault !== "boolean" ||
        !Array.isArray(d.widgets)
      ) {
        throw new Error("Invalid dashboard shape");
      }
      return {
        id: d.id,
        name: d.name.trim(),
        isDefault: d.isDefault,
        widgets: d.widgets as DashboardWidget[],
      };
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid data" },
      { status: 400 },
    );
  }

  // Ensure exactly one default
  const defaults = dashboards.filter((d) => d.isDefault);
  if (defaults.length === 0) {
    dashboards[0].isDefault = true;
  } else if (defaults.length > 1) {
    // Keep only the last one marked as default
    for (let i = 0; i < dashboards.length - 1; i++) {
      if (dashboards[i].isDefault && defaults.length > 1) {
        dashboards[i].isDefault = false;
      }
    }
  }

  const db = getDb();
  try {
    await db
      .insert(userSettings)
      .values({ userId: session.user.id, dashboards })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { dashboards },
      });
  } catch (err) {
    console.error("[PATCH /api/settings/dashboards] DB error:", err);
    return Response.json(
      { error: "Failed to save dashboards" },
      { status: 500 },
    );
  }

  return Response.json(dashboards);
}
