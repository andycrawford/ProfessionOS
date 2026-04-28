// GET /api/calendar-events
// Returns calendar activity items for the authenticated user, mapped to a
// shape that CalendarView can render directly.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { activityItems, connectedServices } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

export interface CalendarEventDTO {
  id: string;
  title: string;
  startIso: string;
  endIso: string | null;
  source: "calendar";
  joinUrl?: string;
  sourceUrl?: string;
  linkBehavior: "new_tab" | "embed";
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch calendar events from the last 60 days + next 90 days
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 60);

  const db = getDb();
  const rows = await db
    .select({
      item: activityItems,
      serviceConfig: connectedServices.config,
    })
    .from(activityItems)
    .leftJoin(connectedServices, eq(activityItems.serviceId, connectedServices.id))
    .where(
      and(
        eq(activityItems.userId, session.user.id),
        eq(activityItems.itemType, "calendar_event"),
        gte(activityItems.occurredAt, rangeStart)
      )
    );

  // Deduplicate by (serviceId, occurredAt): if the same meeting was inserted
  // multiple times before the delete-then-reinsert fix, keep only the most
  // recently created row so the calendar view doesn't show phantom duplicates.
  const seen = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    const key = `${row.item.serviceId ?? ""}:${(row.item.occurredAt ?? row.item.createdAt).toISOString()}`;
    const existing = seen.get(key);
    if (!existing || row.item.createdAt > existing.item.createdAt) {
      seen.set(key, row);
    }
  }

  const events: CalendarEventDTO[] = Array.from(seen.values()).map((row) => {
    const meta = (row.item.metadata ?? {}) as Record<string, unknown>;

    // Derive Teams join URL — same logic as the SSE feed route.
    let joinUrl: string | undefined;
    if (meta?.isOnlineMeeting) {
      if (typeof meta.onlineMeetingUrl === "string") {
        joinUrl = meta.onlineMeetingUrl;
      } else if (row.item.sourceUrl?.includes("teams.microsoft.com")) {
        joinUrl = row.item.sourceUrl;
      }
    }

    const serviceConfig = (row.serviceConfig ?? {}) as Record<string, unknown>;
    const linkBehavior: "new_tab" | "embed" =
      serviceConfig.linkBehavior === "embed" ? "embed" : "new_tab";

    return {
      id: row.item.id,
      title: row.item.title,
      startIso: (row.item.occurredAt ?? new Date()).toISOString(),
      endIso: typeof meta.endTime === "string" ? meta.endTime : null,
      source: "calendar",
      joinUrl,
      sourceUrl: row.item.sourceUrl ?? undefined,
      linkBehavior,
    };
  });

  return Response.json(events);
}
