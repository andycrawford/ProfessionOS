// GET /api/calendar-events
// Returns calendar activity items for the authenticated user, mapped to a
// shape that CalendarView can render directly.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { activityItems } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

export interface CalendarEventDTO {
  id: string;
  title: string;
  startIso: string;
  endIso: string | null;
  source: "calendar";
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
    .select()
    .from(activityItems)
    .where(
      and(
        eq(activityItems.userId, session.user.id),
        eq(activityItems.itemType, "calendar_event"),
        gte(activityItems.occurredAt, rangeStart)
      )
    );

  const events: CalendarEventDTO[] = rows.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      title: row.title,
      startIso: (row.occurredAt ?? new Date()).toISOString(),
      endIso: typeof meta.endTime === "string" ? meta.endTime : null,
      source: "calendar",
    };
  });

  return Response.json(events);
}
