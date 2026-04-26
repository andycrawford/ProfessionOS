// Organizations API — get the current user's org or create a new one.
// GET  /api/organizations  — return the org where the current user is a member (or null)
// POST /api/organizations  — create a new org and add the caller as admin

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Find the org this user belongs to (there is at most one per user for now)
  const [membership] = await db
    .select({
      org: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);

  if (!membership) {
    return Response.json(null);
  }

  // Never expose the client secret in the response
  const { ssoClientSecret: _secret, ...safeOrg } = membership.org;

  return Response.json({
    ...safeOrg,
    // indicate whether a secret is set without revealing it
    ssoClientSecretSet: !!membership.org.ssoClientSecret,
    userRole: membership.role,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, domain } = body;
  if (!name || !domain) {
    return Response.json({ error: "name and domain are required" }, { status: 400 });
  }

  const db = getDb();

  // Only allow creating one org per user
  const [existing] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, session.user.id))
    .limit(1);

  if (existing) {
    return Response.json({ error: "Already a member of an organization" }, { status: 409 });
  }

  const [org] = await db
    .insert(organizations)
    .values({ name, domain })
    .returning();

  await db.insert(organizationMembers).values({
    userId: session.user.id,
    organizationId: org.id,
    role: "admin",
  });

  const { ssoClientSecret: _secret, ...safeOrg } = org;

  return Response.json(
    { ...safeOrg, ssoClientSecretSet: false, userRole: "admin" },
    { status: 201 }
  );
}
