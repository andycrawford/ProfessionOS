// Activity item status update.
// PATCH /api/items/[id]  — mark an item as seen, actioned, or dismissed

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { activityItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_STATUSES = new Set(["seen", "actioned", "dismissed"]);

type Params = { id: string };

export async function PATCH(req: Request, { params }: { params: Promise<Params> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body;

  if (!status || !VALID_STATUSES.has(status)) {
    return Response.json(
      { error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  // Record when the item was actioned so it can be surfaced in audit logs
  if (status === "actioned") patch.actionedAt = now;

  const db = getDb();

  const [updated] = await db
    .update(activityItems)
    .set(patch)
    .where(and(eq(activityItems.id, id), eq(activityItems.userId, session.user.id)))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(updated);
}
