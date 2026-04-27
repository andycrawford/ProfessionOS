// Approve an activity item in an external service.
// POST /api/services/[id]/approve
//
// Body: { externalId: string, action?: string }
//   externalId — the activity item's externalId (format: "{recordType}:{recordId}" for NetSuite)
//   action     — optional hint for multi-step approval workflows (default: "approve")
//
// Returns: { ok: boolean }

export const dynamic = "force-dynamic";

import "@/services/plugins"; // populate plugin registry
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPlugin } from "@/services/registry";
import type { ServiceType } from "@/services/types";

type Params = { id: string };

export async function POST(req: Request, { params }: { params: Promise<Params> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.externalId !== "string") {
    return Response.json({ error: "externalId is required" }, { status: 400 });
  }

  const { externalId, action = "approve" } = body as { externalId: string; action?: string };

  const db = getDb();

  // Load the service — must belong to the current user
  const [service] = await db
    .select()
    .from(connectedServices)
    .where(
      and(eq(connectedServices.id, id), eq(connectedServices.userId, session.user.id))
    );

  if (!service) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const plugin = getPlugin(service.type as ServiceType);
  if (!plugin) {
    return Response.json({ error: `No plugin registered for type: ${service.type}` }, { status: 400 });
  }
  if (!plugin.approveItem) {
    return Response.json(
      { error: `Plugin "${service.type}" does not support approvals` },
      { status: 422 }
    );
  }

  const config = service.config as Record<string, unknown>;
  const credentials = service.credentials as Record<string, unknown>;

  try {
    const ok = await plugin.approveItem(
      { ...config, ...credentials },
      externalId,
      action
    );

    if (ok) {
      // Mark the corresponding activity item as actioned so the feed reflects the change
      const now = new Date();
      await db
        .update(activityItems)
        .set({ status: "actioned", actionedAt: now, updatedAt: now })
        .where(
          and(
            eq(activityItems.userId, session.user.id),
            eq(activityItems.externalId, externalId)
          )
        );
    }

    return Response.json({ ok });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 422 });
  }
}
