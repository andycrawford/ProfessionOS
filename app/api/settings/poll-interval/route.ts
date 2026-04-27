// Poll interval settings API — read and write the user's dashboard refresh rate.
// GET  /api/settings/poll-interval  — returns { pollIntervalSeconds: number }
// PATCH /api/settings/poll-interval — updates pollIntervalSeconds

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const VALID_INTERVALS = [15, 30, 60, 300, 900]; // 15s, 30s, 1m, 5m, 15m
const DEFAULT_INTERVAL = 30;

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ pollIntervalSeconds: userSettings.pollIntervalSeconds })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id));

  return Response.json({ pollIntervalSeconds: row?.pollIntervalSeconds ?? DEFAULT_INTERVAL });
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { pollIntervalSeconds } = body ?? {};

  if (!VALID_INTERVALS.includes(pollIntervalSeconds)) {
    return Response.json(
      { error: `pollIntervalSeconds must be one of: ${VALID_INTERVALS.join(", ")}` },
      { status: 400 }
    );
  }

  const db = getDb();
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, pollIntervalSeconds })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { pollIntervalSeconds },
    });

  return Response.json({ pollIntervalSeconds });
}
