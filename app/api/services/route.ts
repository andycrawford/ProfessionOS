// Services API — list and create connected service integrations.
// GET  /api/services  — list user's services with activity item counts
// POST /api/services  — add a new service (validates with testConnection)

export const dynamic = "force-dynamic";

import "@/services/plugins"; // populate plugin registry
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getPlugin } from "@/services/registry";
import type { ServiceType } from "@/services/types";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const services = await db
    .select({
      id: connectedServices.id,
      userId: connectedServices.userId,
      type: connectedServices.type,
      displayName: connectedServices.displayName,
      config: connectedServices.config,
      enabled: connectedServices.enabled,
      status: connectedServices.status,
      lastPollAt: connectedServices.lastPollAt,
      lastError: connectedServices.lastError,
      createdAt: connectedServices.createdAt,
      itemCount: count(activityItems.id),
    })
    .from(connectedServices)
    .leftJoin(activityItems, eq(activityItems.serviceId, connectedServices.id))
    .where(eq(connectedServices.userId, session.user.id))
    .groupBy(
      connectedServices.id,
      connectedServices.userId,
      connectedServices.type,
      connectedServices.displayName,
      connectedServices.config,
      connectedServices.enabled,
      connectedServices.status,
      connectedServices.lastPollAt,
      connectedServices.lastError,
      connectedServices.createdAt
    );

  return Response.json(services);
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, displayName, config = {}, credentials = {} } = body;

  if (!type || !displayName) {
    return Response.json({ error: "type and displayName are required" }, { status: 400 });
  }

  const plugin = getPlugin(type as ServiceType);
  if (!plugin) {
    return Response.json({ error: `Unknown service type: ${type}` }, { status: 400 });
  }

  try {
    const ok = await plugin.testConnection(config, credentials);
    if (!ok) {
      return Response.json({ error: "Connection test failed" }, { status: 422 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Connection test failed" },
      { status: 422 }
    );
  }

  const db = getDb();
  const [service] = await db
    .insert(connectedServices)
    .values({
      userId: session.user.id,
      type,
      displayName,
      config,
      credentials,
      enabled: true,
      status: "ok",
    })
    .returning();

  return Response.json(service, { status: 201 });
}
