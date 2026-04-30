// GET /api/automations/[id]/runs — list run history for an automation

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { automations, automationRuns } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const db = getDb();

  // Verify ownership
  const [automation] = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.userId, session.user.id)))
    .limit(1);

  if (!automation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);

  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, id))
    .orderBy(desc(automationRuns.createdAt))
    .limit(limit);

  return Response.json(runs);
}
