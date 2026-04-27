import type { ReactNode } from "react";
import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await safeAuth();

  let orgLogoUrl: string | null = null;
  let orgName: string | null = null;

  if (session?.user?.id) {
    try {
      const db = getDb();
      const [membership] = await db
        .select({ logoUrl: organizations.logoUrl, name: organizations.name })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(eq(organizationMembers.userId, session.user.id))
        .limit(1);

      if (membership) {
        orgLogoUrl = membership.logoUrl ?? null;
        orgName = membership.name;
      }
    } catch {
      // Migration may not have run yet; fall back to default branding
    }
  }

  return (
    <DashboardShell
      orgLogoUrl={orgLogoUrl}
      orgName={orgName}
      userName={session?.user?.name ?? null}
      userEmail={session?.user?.email ?? null}
    >
      {children}
    </DashboardShell>
  );
}
