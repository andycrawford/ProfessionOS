import type { ServicePlugin, ServiceType } from "@/services/types";
import { getDb } from "@/db";
import { customPlugins } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const registry = new Map<ServiceType, ServicePlugin>();

export function registerPlugin(plugin: ServicePlugin): void {
  registry.set(plugin.type, plugin);
}

export function getPlugin(type: ServiceType): ServicePlugin | undefined {
  return registry.get(type);
}

export function getAllPlugins(): ServicePlugin[] {
  return Array.from(registry.values());
}

export function getPluginTypes(): ServiceType[] {
  return Array.from(registry.keys());
}

/**
 * Loads and registers AI-generated custom plugins for a specific user.
 * Each plugin's code is a JS object literal implementing the ServicePlugin interface.
 *
 * Uses Function() eval — acceptable because:
 * - Code is user-authored and only affects that user's own session.
 * - Vercel serverless does not support native-module sandboxes (vm2, isolated-vm).
 * Upgrade path: replace with a proper sandbox when native modules become available.
 */
export async function loadCustomPluginsForUser(userId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(customPlugins)
    .where(and(eq(customPlugins.userId, userId), eq(customPlugins.enabled, true)));

  for (const row of rows) {
    try {
      // eslint-disable-next-line no-new-func
      const plugin = new Function(`"use strict"; return (${row.code})`)() as ServicePlugin;
      registerPlugin(plugin);
    } catch (err) {
      console.error(
        `[customPlugin] Failed to load plugin "${row.type}" for user ${userId}:`,
        err
      );
    }
  }
}
