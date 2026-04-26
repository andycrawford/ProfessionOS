// Organization detail API — update SSO config or list members.
// GET   /api/organizations/[id]          — list members (admin only)
// PATCH /api/organizations/[id]          — update org name, domain, or SSO config (admin only)

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { organizations, organizationMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin(userId: string, orgId: string) {
  const db = getDb();
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, orgId)
      )
    )
    .limit(1);
  return membership?.role === "admin" ? membership : null;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = await requireAdmin(session.user.id, id);
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();

  const members = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, id));

  return Response.json(members);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = await requireAdmin(session.user.id, id);
  if (!admin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, domain, ssoEnabled, entraIdTenantId, ssoClientId, ssoClientSecret } = body;

  // Build the update object — only include fields that were explicitly provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (domain !== undefined) updates.domain = domain;
  if (ssoEnabled !== undefined) updates.ssoEnabled = Boolean(ssoEnabled);
  if (entraIdTenantId !== undefined) updates.entraIdTenantId = entraIdTenantId || null;
  if (ssoClientId !== undefined) updates.ssoClientId = ssoClientId || null;
  // Only update the secret when the caller explicitly provides a non-empty value
  if (ssoClientSecret !== undefined && ssoClientSecret !== "") {
    updates.ssoClientSecret = ssoClientSecret;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const db = getDb();

  const [updated] = await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { ssoClientSecret: _secret, ...safeOrg } = updated;

  return Response.json({
    ...safeOrg,
    ssoClientSecretSet: !!updated.ssoClientSecret,
    userRole: "admin",
  });
}
