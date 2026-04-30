// Cron polling orchestrator — runs on a 5-minute schedule via Vercel Cron.
// GET: called by Vercel Cron (validates CRON_SECRET bearer token)
// POST: manual trigger scoped to the authenticated user
//
// Also checks enabled schedule-triggered automations and fires them when due.

export const dynamic = "force-dynamic";

import "@/services/plugins"; // populate plugin registry
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems, automations } from "@/db/schema";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm";
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
      let credentials = service.credentials as Record<string, unknown>;

      // Give the plugin a chance to refresh short-lived OAuth tokens before polling.
      // If new credentials are returned, persist them so the next run uses them.
      if (plugin.refreshCredentials) {
        try {
          const refreshed = await plugin.refreshCredentials(config, credentials);
          if (refreshed) {
            credentials = refreshed as Record<string, unknown>;
            await db
              .update(connectedServices)
              .set({ credentials })
              .where(eq(connectedServices.id, service.id));
          }
        } catch (refreshErr) {
          // A failed refresh is non-fatal — log and attempt poll with existing token.
          console.error(
            `[cron/poll] Token refresh failed for service ${service.id}:`,
            refreshErr instanceof Error ? refreshErr.message : refreshErr
          );
        }
      }

      const items = await plugin.poll(config, credentials);
      summary.polled++;

      if (items.length > 0) {
        const now = new Date();

        // ── Calendar events: delete-then-reinsert upcoming occurrences ──────────
        // Microsoft Graph's /calendarview assigns a new occurrence ID each time a
        // recurring meeting enters the lookahead window, so insert-only dedup
        // would accumulate one row per occurrence per series per poll. Instead,
        // wipe all future calendar_event rows for this service and reinsert fresh.
        const calendarItems = items.filter((i) => i.itemType === "calendar_event");
        const otherItems = items.filter((i) => i.itemType !== "calendar_event");

        if (calendarItems.length > 0) {
          await db
            .delete(activityItems)
            .where(
              and(
                eq(activityItems.serviceId, service.id),
                eq(activityItems.itemType, "calendar_event"),
                gte(activityItems.occurredAt, now)
              )
            );
          await db.insert(activityItems).values(
            calendarItems.map((item) => ({
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
              occurredAt: item.occurredAt ?? now,
            }))
          );
          summary.inserted += calendarItems.length;
        }

        // ── Other item types: insert-if-not-exists ──────────────────────────────
        if (otherItems.length > 0) {
          const existing = await db
            .select({ externalId: activityItems.externalId })
            .from(activityItems)
            .where(eq(activityItems.serviceId, service.id));

          const existingIds = new Set(existing.map((r) => r.externalId));
          const newItems = otherItems.filter((item) => !existingIds.has(item.externalId));

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
                occurredAt: item.occurredAt ?? now,
              }))
            );
            summary.inserted += newItems.length;
          }
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

// ─── Automation scheduler ──────────────────────────────────────────────────────

// Simple cron expression checker — supports minute/hour/day-of-month/month/day-of-week.
// Returns true when the given Date matches the cron expression (minute-level precision).
function cronMatches(expr: string, now: Date): boolean {
  try {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [minP, hourP, domP, monP, dowP] = parts;
    const check = (part: string, value: number): boolean => {
      if (part === "*") return true;
      return part.split(",").some((seg) => {
        if (seg.includes("/")) {
          const [, step] = seg.split("/");
          return value % parseInt(step) === 0;
        }
        if (seg.includes("-")) {
          const [lo, hi] = seg.split("-").map(Number);
          return value >= lo && value <= hi;
        }
        return parseInt(seg) === value;
      });
    };
    return (
      check(minP, now.getUTCMinutes()) &&
      check(hourP, now.getUTCHours()) &&
      check(domP, now.getUTCDate()) &&
      check(monP, now.getUTCMonth() + 1) &&
      check(dowP, now.getUTCDay())
    );
  } catch {
    return false;
  }
}

async function runDueAutomations(userId?: string) {
  const db = getDb();
  const now = new Date();
  // Look back 6 minutes so a cron firing at 4:59 still catches a "* * * * *" that was due at 5:00
  const windowStart = new Date(now.getTime() - 6 * 60 * 1000);

  const where = and(
    eq(automations.enabled, true),
    eq(automations.triggerType, "schedule"),
    userId ? eq(automations.userId, userId) : undefined,
    // Only run if not run in the last window (prevents double-firing within same 5-min tick)
    or(isNull(automations.lastRunAt), lte(automations.lastRunAt, windowStart))
  );

  const due = await db.select().from(automations).where(where);

  let fired = 0;
  for (const auto of due) {
    const config = auto.triggerConfig as Record<string, unknown>;
    const cronExpr = typeof config.cron === "string" ? config.cron : null;
    if (!cronExpr || !cronMatches(cronExpr, now)) continue;

    // Fire via the run API internally
    try {
      const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
      await fetch(`${baseUrl}/api/automations/${auto.id}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Internal cron token so the route can trust the call
          "X-Cron-Secret": process.env.CRON_SECRET ?? "",
        },
        body: JSON.stringify({ dryRun: false }),
      });
      fired++;
    } catch {
      // Non-fatal — the automation's lastRunStatus will remain as-is
    }
  }

  return fired;
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

  const [summary, automationsFired] = await Promise.all([
    pollServices(),
    runDueAutomations(),
  ]);
  return Response.json({ ok: true, ...summary, automationsFired });
}

// Manual trigger — scoped to the authenticated user's services only.
export async function POST() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [summary, automationsFired] = await Promise.all([
    pollServices(session.user.id),
    runDueAutomations(session.user.id),
  ]);
  return Response.json({ ok: true, ...summary, automationsFired });
}
