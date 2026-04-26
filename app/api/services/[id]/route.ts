// Service detail API — get, update, or remove a single connected service.
// GET    /api/services/[id]  — service detail (scoped to current user)
// PATCH  /api/services/[id]  — update displayName, config, credentials, or enabled flag
// DELETE /api/services/[id]  — remove service (activityItems.serviceId set to null via FK cascade)

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { id: string };

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [service] = await db
    .select()
    .from(connectedServices)
    .where(and(eq(connectedServices.id, id), eq(connectedServices.userId, session.user.id)));

  if (!service) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(service);
}

export async function PATCH(req: Request, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership before mutating
  const [existing] = await db
    .select({ id: connectedServices.id })
    .from(connectedServices)
    .where(and(eq(connectedServices.id, id), eq(connectedServices.userId, session.user.id)));

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { displayName, config, credentials, enabled } = body;

  const patch: Partial<{
    displayName: string;
    config: Record<string, unknown>;
    credentials: Record<string, unknown>;
    enabled: boolean;
  }> = {};
  if (displayName !== undefined) patch.displayName = displayName;
  if (config !== undefined) patch.config = config;
  if (credentials !== undefined) patch.credentials = credentials;
  if (enabled !== undefined) patch.enabled = enabled;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(connectedServices)
    .set(patch)
    .where(eq(connectedServices.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<Params> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [deleted] = await db
    .delete(connectedServices)
    .where(and(eq(connectedServices.id, id), eq(connectedServices.userId, session.user.id)))
    .returning({ id: connectedServices.id });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
