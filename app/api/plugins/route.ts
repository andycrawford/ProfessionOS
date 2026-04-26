// GET /api/plugins — list the authenticated user's AI-generated custom plugins.

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customPlugins } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: customPlugins.id,
      type: customPlugins.type,
      name: customPlugins.name,
      description: customPlugins.description,
      enabled: customPlugins.enabled,
      createdAt: customPlugins.createdAt,
      updatedAt: customPlugins.updatedAt,
    })
    .from(customPlugins)
    .where(eq(customPlugins.userId, session.user.id))
    .orderBy(desc(customPlugins.createdAt));

  return NextResponse.json(rows);
}
