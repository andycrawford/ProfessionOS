// GET /api/ai/conversations — list the authenticated user's AI conversations.

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    // Unauthenticated (e.g. demo mode) — return an empty list so the dashboard
    // renders without a conversation history panel rather than showing an error.
    return NextResponse.json([]);
  }

  const db = getDb();

  const rows = await db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      createdAt: aiConversations.createdAt,
      updatedAt: aiConversations.updatedAt,
      messageCount: sql<number>`cast(count(${aiMessages.id}) as int)`,
    })
    .from(aiConversations)
    .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
    .where(eq(aiConversations.userId, session.user.id))
    .groupBy(
      aiConversations.id,
      aiConversations.title,
      aiConversations.createdAt,
      aiConversations.updatedAt
    )
    .orderBy(desc(aiConversations.updatedAt));

  return NextResponse.json(rows);
}
