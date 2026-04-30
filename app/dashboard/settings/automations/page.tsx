import { redirect } from "next/navigation";
import Link from "next/link";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { automations, connectedServices } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

import AutomationsClient, { type AutomationRow } from "./AutomationsClient";
import styles from "./automations.module.css";

export default async function AutomationsPage() {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/sign-in");

  const db = getDb();
  const userId = session.user.id;

  // All user services — used to check for code_automation plugin and to look up names
  const allServices = await db
    .select({ id: connectedServices.id, type: connectedServices.type, displayName: connectedServices.displayName })
    .from(connectedServices)
    .where(eq(connectedServices.userId, userId));

  const hasPlugin = allServices.some((s) => s.type === "code_automation");
  const serviceMap = Object.fromEntries(allServices.map((s) => [s.id, s.displayName]));

  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      description: automations.description,
      triggerType: automations.triggerType,
      enabled: automations.enabled,
      writeMode: automations.writeMode,
      lastRunAt: automations.lastRunAt,
      lastRunStatus: automations.lastRunStatus,
      pluginServiceId: automations.pluginServiceId,
      createdAt: automations.createdAt,
    })
    .from(automations)
    .where(eq(automations.userId, userId))
    .orderBy(desc(automations.createdAt));

  const automationRows: AutomationRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    triggerType: r.triggerType,
    enabled: r.enabled,
    writeMode: r.writeMode,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    lastRunStatus: r.lastRunStatus ?? null,
    pluginServiceId: r.pluginServiceId,
    pluginServiceName: serviceMap[r.pluginServiceId] ?? "Unknown Plugin",
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.heading}>Automations</h1>
            <p className={styles.subheading}>
              AI-assisted automations built with Code Automation plugins.
            </p>
          </div>
          {hasPlugin && (
            <Link href="/dashboard/code" className={styles.newButton}>
              + New Automation
            </Link>
          )}
        </div>
      </div>

      {!hasPlugin ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚡</div>
          <p className={styles.emptyTitle}>No automation plugin connected</p>
          <p className={styles.emptyBody}>
            Connect a Code Automation plugin in Services to start building automations.
          </p>
          <Link href="/dashboard/settings/services/new" className={styles.emptyAction}>
            Connect a Service
          </Link>
        </div>
      ) : (
        <AutomationsClient automations={automationRows} />
      )}
    </div>
  );
}
