import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, activityItems } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import "@/services/plugins"; // populate plugin registry
import { getPlugin } from "@/services/registry";
import type { ServiceType, ServiceStatus } from "@/services/types";

import ServicesListClient, { type ServiceRow } from "./ServicesListClient";
import styles from "./services.module.css";

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const db = getDb();

  const rows = await db
    .select({
      id: connectedServices.id,
      type: connectedServices.type,
      displayName: connectedServices.displayName,
      status: connectedServices.status,
      lastPollAt: connectedServices.lastPollAt,
      itemCount: count(activityItems.id),
    })
    .from(connectedServices)
    .leftJoin(activityItems, eq(activityItems.serviceId, connectedServices.id))
    .where(eq(connectedServices.userId, session.user.id))
    .groupBy(
      connectedServices.id,
      connectedServices.type,
      connectedServices.displayName,
      connectedServices.status,
      connectedServices.lastPollAt
    );

  // Enrich each row with plugin icon + color from the registry
  const services: ServiceRow[] = rows.map((row) => {
    const plugin = getPlugin(row.type as ServiceType);
    return {
      id: row.id,
      type: row.type,
      displayName: row.displayName,
      icon: plugin?.icon ?? "Plug",
      color: plugin?.color ?? "var(--color-text-secondary)",
      status: row.status as ServiceStatus,
      lastPollAt: row.lastPollAt?.toISOString() ?? null,
      itemCount: Number(row.itemCount),
    };
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Connected Services</h1>
          <p className={styles.subheading}>
            Manage the services Profession OS monitors on your behalf.
          </p>
        </div>
        <Link
          href="/dashboard/settings/services/new"
          className={styles.addButton}
        >
          <Plus size={14} aria-hidden="true" />
          Add Service
        </Link>
      </div>

      <ServicesListClient services={services} />
    </div>
  );
}
