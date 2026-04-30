// Returns connected AI-capable services as { label, value } options for the
// dynamic-select field in the Code Automation plugin config form.
// Phase 1: claude_ai only. Future AI plugins (openai, gemini) will appear here
// automatically once their plugin type is added to AI_SERVICE_TYPES.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// Extend this list as new AI service plugins are added.
const AI_SERVICE_TYPES = ["claude_ai"];

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const services = await db
    .select({
      id: connectedServices.id,
      displayName: connectedServices.displayName,
      type: connectedServices.type,
    })
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, session.user.id),
        eq(connectedServices.enabled, true),
        inArray(connectedServices.type, AI_SERVICE_TYPES)
      )
    );

  const options = services.map((s) => ({
    label: `${s.displayName} (${s.type})`,
    value: s.id,
  }));

  return Response.json(options);
}
