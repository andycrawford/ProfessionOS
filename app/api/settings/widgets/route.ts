// Widget preferences API — read and write dashboard metric tile configuration.
// GET  /api/settings/widgets  — returns user's widget preferences (or defaults)
// PATCH /api/settings/widgets  — saves widget preferences

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WIDGET_PREFS } from "@/lib/types";
import type { WidgetPreference, WidgetServiceKey } from "@/lib/types";

const VALID_KEYS: WidgetServiceKey[] = ["mail", "calendar", "messaging", "code", "crm"];

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ widgetPreferences: userSettings.widgetPreferences })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  const prefs = (row?.widgetPreferences as WidgetPreference[] | null) ?? DEFAULT_WIDGET_PREFS;
  return Response.json(prefs);
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
      if (!VALID_KEYS.includes(p.key as WidgetServiceKey) || typeof p.enabled !== "boolean") {
        throw new Error(`Invalid preference: ${JSON.stringify(item)}`);
      }
      return { key: p.key as WidgetServiceKey, enabled: p.enabled };
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid preferences" },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, widgetPreferences: prefs })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { widgetPreferences: prefs },
    });

  return Response.json(prefs);
}
