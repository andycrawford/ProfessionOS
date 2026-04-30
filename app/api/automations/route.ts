// GET  /api/automations       — list user's automations (optionally filtered by pluginServiceId)
// POST /api/automations       — create a new automation

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { automations, connectedServices } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pluginServiceId = url.searchParams.get("pluginServiceId");

  const db = getDb();
  const where = pluginServiceId
    ? and(
        eq(automations.userId, session.user.id),
        eq(automations.pluginServiceId, pluginServiceId)
      )
    : eq(automations.userId, session.user.id);

  const rows = await db
    .select()
    .from(automations)
    .where(where)
    .orderBy(desc(automations.createdAt));

  return Response.json(rows);
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { pluginServiceId, name, description, triggerType, triggerConfig, targetServiceIds, actionConfig, aiServiceId } = body;

  if (!pluginServiceId || typeof pluginServiceId !== "string") {
    return Response.json({ error: "pluginServiceId is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const db = getDb();

  // Verify the plugin service belongs to this user
  const [service] = await db
    .select({ id: connectedServices.id })
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.id, pluginServiceId),
        eq(connectedServices.userId, session.user.id)
      )
    )
    .limit(1);

  if (!service) {
    return Response.json({ error: "Service not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(automations)
    .values({
      userId: session.user.id,
      pluginServiceId,
      aiServiceId: typeof aiServiceId === "string" ? aiServiceId : null,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      triggerType: typeof triggerType === "string" ? triggerType : "manual",
      triggerConfig: triggerConfig ?? {},
      targetServiceIds: Array.isArray(targetServiceIds) ? targetServiceIds : [],
      actionConfig: actionConfig ?? {},
      enabled: true,
      writeMode: "read_only",
    })
    .returning();

  return Response.json(created, { status: 201 });
}
