// Activity items feed — paginated list with optional filters.
// GET /api/items?serviceId=&urgency=&status=&itemType=&page=&limit=

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { activityItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const urgencyParam = searchParams.get("urgency");
  const status = searchParams.get("status");
  const itemType = searchParams.get("itemType");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;

  const db = getDb();
  const userId = session.user.id;

  // Build filter conditions — userId is always required to scope to current user
  const conditions = [eq(activityItems.userId, userId)];
  if (serviceId) conditions.push(eq(activityItems.serviceId, serviceId));
  if (urgencyParam !== null) {
    const urgency = parseInt(urgencyParam, 10);
    if (!isNaN(urgency)) conditions.push(eq(activityItems.urgency, urgency));
  }
  if (status) conditions.push(eq(activityItems.status, status));
  if (itemType) conditions.push(eq(activityItems.itemType, itemType));

  const items = await db
    .select()
    .from(activityItems)
    .where(and(...conditions))
    .orderBy(desc(activityItems.urgency), desc(activityItems.occurredAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ items, page, limit });
}
