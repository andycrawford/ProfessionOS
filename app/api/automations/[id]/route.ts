// GET    /api/automations/[id]   — get automation detail
// PATCH  /api/automations/[id]   — update automation
// DELETE /api/automations/[id]   — delete automation

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { automations } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function getAutomation(id: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getAutomation(id, session.user.id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getAutomation(id, session.user.id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed = [
    "name", "description", "triggerType", "triggerConfig",
    "targetServiceIds", "actionConfig", "aiServiceId", "enabled",
    // writeMode is intentionally excluded — cannot be set to read_write in Phase 1
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  updates.updatedAt = new Date();

  const db = getDb();
  const [updated] = await db
    .update(automations)
    .set(updates)
    .where(and(eq(automations.id, id), eq(automations.userId, session.user.id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getAutomation(id, session.user.id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  await db
    .delete(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, session.user.id)));

  return Response.json({ ok: true });
}
