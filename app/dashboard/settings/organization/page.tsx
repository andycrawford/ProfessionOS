import { redirect } from "next/navigation";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { organizations, organizationMembers } from "@/db/schema";
import { eq } from "drizzle-orm";

import OrganizationClient, { type OrgData } from "./OrganizationClient";
import styles from "./organization.module.css";

export default async function OrganizationPage() {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/sign-in");

  let orgData: OrgData | null = null;

  try {
    const db = getDb();

    // Find the org this user belongs to (if any)
    const [membership] = await db
      .select({
        org: organizations,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, session.user.id))
      .limit(1);

    if (membership) {
      const { ssoClientSecret: _secret, ...safeOrg } = membership.org;
      orgData = {
        ...safeOrg,
        ssoClientSecretSet: !!membership.org.ssoClientSecret,
        userRole: membership.role as "admin" | "member",
      };
    }
  } catch {
    // Migration may not have run yet (e.g. logo_url column missing); degrade gracefully
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Organization</h1>
          <p className={styles.subheading}>
            Manage your organization profile and enterprise SSO settings.
          </p>
        </div>
      </div>

      <OrganizationClient org={orgData} />
    </div>
  );
}
