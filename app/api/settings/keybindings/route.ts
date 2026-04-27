// Keybindings settings API — read and write user keyboard shortcut overrides.
// GET  /api/settings/keybindings  — returns merged keybindings (defaults + user overrides + plugin shortcuts)
// PATCH /api/settings/keybindings  — saves user overrides (Record<actionId, key>)

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings, connectedServices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_KEYBINDINGS } from "@/lib/types";
import type { KeybindingOverrides } from "@/lib/types";
import { getAllPlugins } from "@/services/registry";

export interface KeybindingResponse {
  overrides: KeybindingOverrides;
  /** Plugin-declared keybindings (action → defaultKey + description) */
  pluginBindings: Array<{
    action: string;
    defaultKey: string;
    description: string;
    pluginName: string;
    pluginType: string;
  }>;
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Load user overrides from DB
  const [row] = await db
    .select({ keybindings: userSettings.keybindings })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  const overrides = (row?.keybindings as KeybindingOverrides | null) ?? {};

  // Collect plugin keybindings from enabled services
  const enabledServices = await db
    .select({ type: connectedServices.type })
    .from(connectedServices)
    .where(eq(connectedServices.userId, session.user.id));

  const enabledTypes = new Set(enabledServices.map((s) => s.type));
  const allPlugins = getAllPlugins();
  const pluginBindings = allPlugins
    .filter((p) => enabledTypes.has(p.type) && p.keybinding)
    .map((p) => ({
      action: p.keybinding!.action,
      defaultKey: p.keybinding!.defaultKey,
      description: p.keybinding!.description,
      pluginName: p.displayName,
      pluginType: p.type,
    }));

  const response: KeybindingResponse = { overrides, pluginBindings };
  return Response.json(response);
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Expected an object of action → key overrides" }, { status: 400 });
  }

  // Validate: keys must be known action ids, values must be non-empty strings
  const validActionIds = new Set(DEFAULT_KEYBINDINGS.map((d) => d.id));
  const overrides: KeybindingOverrides = {};
  for (const [actionId, key] of Object.entries(body)) {
    if (typeof key !== "string" || key.trim() === "") continue;
    // Allow plugin action ids (prefixed with "plugin:") as well as built-in ids
    if (!validActionIds.has(actionId) && !actionId.startsWith("plugin:")) continue;
    overrides[actionId] = key.trim().toLowerCase();
  }

  const db = getDb();
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, keybindings: overrides })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { keybindings: overrides },
    });

  return Response.json({ overrides });
}
