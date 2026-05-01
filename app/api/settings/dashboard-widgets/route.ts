// Dashboard widgets API — read and write free-form tile configuration.
// GET  /api/settings/dashboard-widgets  — returns user's dashboard widgets (or empty array)
// PATCH /api/settings/dashboard-widgets — saves dashboard widgets array

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { DashboardWidget } from "@/lib/types";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  try {
    const [row] = await db
      .select({ dashboardWidgets: userSettings.dashboardWidgets })
      .from(userSettings)
      .where(eq(userSettings.userId, session.user.id));

    const widgets: DashboardWidget[] =
      (row?.dashboardWidgets as DashboardWidget[] | null) ?? [];

    return Response.json(widgets, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/settings/dashboard-widgets] DB error:", err);
    return Response.json(
      { error: "Failed to load dashboard widgets" },
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
  if (!Array.isArray(body)) {
    return Response.json(
      { error: "Expected an array of dashboard widgets" },
      { status: 400 },
    );
  }

  // Light validation — ensure each item has required fields
  const VALID_TYPES = new Set(["ai_custom", "clock", "weather"]);

  let widgets: DashboardWidget[];
  try {
    widgets = body.map((item: unknown) => {
      const w = item as Record<string, unknown>;
      if (
        typeof w.id !== "string" ||
        typeof w.title !== "string" ||
        typeof w.type !== "string" ||
        !VALID_TYPES.has(w.type) ||
        typeof w.x !== "number" ||
        typeof w.y !== "number" ||
        typeof w.width !== "number" ||
        typeof w.height !== "number"
      ) {
        throw new Error("Invalid widget shape");
      }
      return {
        id: w.id,
        title: w.title,
        content: typeof w.content === "string" ? w.content : "",
        type: w.type as DashboardWidget["type"],
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        collapsed: Boolean(w.collapsed),
        ...(w.config && typeof w.config === "object"
          ? { config: w.config as Record<string, unknown> }
          : {}),
      };
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid widget data" },
      { status: 400 },
    );
  }

  const db = getDb();
  try {
    await db
      .insert(userSettings)
      .values({ userId: session.user.id, dashboardWidgets: widgets })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { dashboardWidgets: widgets },
      });
  } catch (err) {
    console.error("[PATCH /api/settings/dashboard-widgets] DB error:", err);
    return Response.json(
      { error: "Failed to save dashboard widgets" },
      { status: 500 },
    );
  }

  return Response.json(widgets);
}
