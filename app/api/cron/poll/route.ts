// Cron polling orchestrator — runs on a 5-minute schedule via Vercel Cron.
// GET: called by Vercel Cron (validates CRON_SECRET bearer token)
// POST: manual trigger scoped to the authenticated user

export const dynamic = "force-dynamic";

import "@/services/plugins"; // populate plugin registry
import { auth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPlugin } from "@/services/registry";
import type { ServiceType } from "@/services/types";

// ─── Core polling logic ────────────────────────────────────────────────────────

async function pollServices(userId?: string) {
  const db = getDb();

  const where = userId
    ? and(eq(connectedServices.userId, userId), eq(connectedServices.enabled, true))
    : eq(connectedServices.enabled, true);

  const services = await db.select().from(connectedServices).where(where);

  const summary = { polled: 0, inserted: 0, errors: 0 };

  for (const service of services) {
    const plugin = getPlugin(service.type as ServiceType);
    if (!plugin) continue;

    // Mark as polling so the UI can show activity
    await db
      .update(connectedServices)
      .set({ status: "polling" })
      .where(eq(connectedServices.id, service.id));

    try {
      const config = service.config as Record<string, unknown>;
      const credentials = service.credentials as Record<string, unknown>;
      const items = await plugin.poll(config, credentials);
      summary.polled++;

      if (items.length > 0) {
        // Fetch existing external IDs for this service to avoid duplicates
        const existing = await db
          .select({ externalId: activityItems.externalId })
          .from(activityItems)
          .where(eq(activityItems.serviceId, service.id));

        const existingIds = new Set(existing.map((r) => r.externalId));
        const newItems = items.filter((item) => !existingIds.has(item.externalId));

        if (newItems.length > 0) {
          await db.insert(activityItems).values(
            newItems.map((item) => ({
              userId: service.userId,
              serviceId: service.id,
              externalId: item.externalId,
              itemType: item.itemType,
              title: item.title,
              body: item.summary ?? null,
              urgency: item.urgency,
              status: "new" as const,
              sourceUrl: item.sourceUrl ?? null,
              metadata: item.metadata,
              occurredAt: item.occurredAt ?? new Date(),
            }))
          );
          summary.inserted += newItems.length;
        }
      }

      await db
        .update(connectedServices)
        .set({ status: "ok", lastPollAt: new Date(), lastError: null })
        .where(eq(connectedServices.id, service.id));
    } catch (err) {
      summary.errors++;
      await db
        .update(connectedServices)
        .set({
          status: "error",
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(connectedServices.id, service.id));
    }
  }

  return summary;
}

// ─── Route handlers ────────────────────────────────────────────────────────────

// Called by Vercel Cron — validates the CRON_SECRET bearer token.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await pollServices();
  return Response.json({ ok: true, ...summary });
}

// Manual trigger — scoped to the authenticated user's services only.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await pollServices(session.user.id);
  return Response.json({ ok: true, ...summary });
}
