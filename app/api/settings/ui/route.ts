// UI preferences settings API — read and write background/panel appearance.
// GET  /api/settings/ui  — returns current UiPreferences (merged with defaults)
// PATCH /api/settings/ui  — validates and persists a full UiPreferences object

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_UI_PREFERENCES } from "@/lib/types";
import type { UiPreferences } from "@/lib/types";

// Must match /public/wallpapers/ filenames (kept in sync with the UI-side WALLPAPER_PRESETS list)
const VALID_PRESET_KEYS = new Set([
  "aurora",
  "cityglow",
  "dusk",
  "ember",
  "forest",
  "midnight",
  "void",
]);

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ uiPreferences: userSettings.uiPreferences })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  const prefs: UiPreferences =
    (row?.uiPreferences as UiPreferences | null) ?? DEFAULT_UI_PREFERENCES;

  return Response.json(prefs);
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Expected a UiPreferences object" }, { status: 400 });
  }

  const prefs: UiPreferences = {};

  // Validate background
  if (body.background !== undefined) {
    const bg = body.background;
    if (!bg || typeof bg !== "object") {
      return Response.json({ error: "background must be an object" }, { status: 400 });
    }
    if (bg.type !== "none" && bg.type !== "preset") {
      return Response.json(
        { error: "background.type must be 'none' or 'preset'" },
        { status: 400 }
      );
    }
    if (bg.type === "preset") {
      if (typeof bg.presetKey !== "string" || !VALID_PRESET_KEYS.has(bg.presetKey)) {
        return Response.json(
          {
            error: `background.presetKey must be one of: ${[...VALID_PRESET_KEYS].join(", ")}`,
          },
          { status: 400 }
        );
      }
      prefs.background = { type: "preset", presetKey: bg.presetKey };
    } else {
      prefs.background = { type: "none" };
    }
  }

  // Validate panels
  if (body.panels !== undefined) {
    const p = body.panels;
    if (!p || typeof p !== "object") {
      return Response.json({ error: "panels must be an object" }, { status: 400 });
    }
    if (typeof p.opacity !== "number" || p.opacity < 0 || p.opacity > 1) {
      return Response.json(
        { error: "panels.opacity must be a number between 0.0 and 1.0" },
        { status: 400 }
      );
    }
    if (typeof p.blur !== "number" || p.blur < 0 || p.blur > 16) {
      return Response.json(
        { error: "panels.blur must be a number between 0 and 16" },
        { status: 400 }
      );
    }
    if (p.tintColor !== undefined) {
      if (typeof p.tintColor !== "string" || !HEX_COLOR_RE.test(p.tintColor)) {
        return Response.json(
          { error: "panels.tintColor must be a valid hex color string (e.g. #fff or #1a2b3c)" },
          { status: 400 }
        );
      }
    }
    prefs.panels = {
      opacity: p.opacity,
      blur: p.blur,
      ...(p.tintColor !== undefined ? { tintColor: p.tintColor } : {}),
    };
  }

  const db = getDb();
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, uiPreferences: prefs })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { uiPreferences: prefs },
    });

  return Response.json(prefs);
}
