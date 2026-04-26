// Service connection test — runs testConnection for an existing service.
// POST /api/services/[id]/test

export const dynamic = "force-dynamic";

import "@/services/plugins"; // populate plugin registry
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPlugin } from "@/services/registry";
import type { ServiceType } from "@/services/types";

type Params = { id: string };

export async function POST(_req: Request, { params }: { params: Promise<Params> }) {
  const session = await safeAuth();
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

  const plugin = getPlugin(service.type as ServiceType);
  if (!plugin) {
    return Response.json({ error: `No plugin registered for type: ${service.type}` }, { status: 400 });
  }

  try {
    const config = service.config as Record<string, unknown>;
    const credentials = service.credentials as Record<string, unknown>;
    const ok = await plugin.testConnection(config, credentials);

    // Persist the result so the UI reflects the current connection state
    await db
      .update(connectedServices)
      .set({
        status: ok ? "ok" : "error",
        lastError: ok ? null : "Connection test failed",
      })
      .where(eq(connectedServices.id, service.id));

    return Response.json({ ok });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(connectedServices)
      .set({ status: "error", lastError: message })
      .where(eq(connectedServices.id, service.id));

    return Response.json({ ok: false, error: message }, { status: 422 });
  }
}
