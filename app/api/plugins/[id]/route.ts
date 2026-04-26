// GET    /api/plugins/[id] — fetch a custom plugin including its code.
// PATCH  /api/plugins/[id] — toggle enabled or update fields.
// DELETE /api/plugins/[id] — delete a custom plugin.

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customPlugins } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function getOwned(userId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customPlugins)
    .where(and(eq(customPlugins.id, id), eq(customPlugins.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getOwned(session.user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getOwned(session.user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const allowed: Partial<typeof row> = {};
  if (typeof body.enabled === "boolean") allowed.enabled = body.enabled;
  if (typeof body.name === "string") allowed.name = body.name;
  if (typeof body.description === "string") allowed.description = body.description;

  const db = getDb();
  const [updated] = await db
    .update(customPlugins)
    .set({ ...allowed, updatedAt: new Date() })
    .where(eq(customPlugins.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await getOwned(session.user.id, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  await db.delete(customPlugins).where(eq(customPlugins.id, id));
  return new NextResponse(null, { status: 204 });
}
