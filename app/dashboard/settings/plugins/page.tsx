import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customPlugins } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

import PluginsClient, { type PluginRow } from "./PluginsClient";
import styles from "./plugins.module.css";

export default async function PluginsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const db = getDb();
  const rows = await db
    .select({
      id: customPlugins.id,
      type: customPlugins.type,
      name: customPlugins.name,
      description: customPlugins.description,
      enabled: customPlugins.enabled,
      createdAt: customPlugins.createdAt,
    })
    .from(customPlugins)
    .where(eq(customPlugins.userId, session.user.id))
    .orderBy(desc(customPlugins.createdAt));

  const plugins: PluginRow[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Custom Plugins</h1>
        <p className={styles.subheading}>
          AI-generated service integrations for your Profession OS workspace.
        </p>
      </div>
      <PluginsClient plugins={plugins} />
    </div>
  );
}
