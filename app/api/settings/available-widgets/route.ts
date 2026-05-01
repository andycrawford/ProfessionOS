// Returns available dashboard widgets from connected service plugins and user automations.
// GET /api/settings/available-widgets
//
// Scans the user's connected services for plugins that declare a `widget` property,
// and loads all automations to offer as runnable widgets.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, automations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPlugin } from "@/services/registry";
import "@/services/plugins"; // ensure all plugins are registered
import type { ServiceType } from "@/services/types";

interface AvailableWidget {
  /** Widget type key — e.g. "plugin:ms365_email" or "automation" */
  widgetType: string;
  displayName: string;
  description: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultConfig: Record<string, unknown>;
  configFields: { key: string; label: string; type: string; options?: { label: string; value: string }[]; placeholder?: string }[];
  /** For plugin widgets: the connected service ID */
  serviceId?: string;
  /** For automation widgets: the automation ID and name */
  automationId?: string;
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const available: AvailableWidget[] = [];

  // ── 1. Plugin widgets from connected services ──────────────────────────────

  const services = await db
    .select({
      id: connectedServices.id,
      type: connectedServices.type,
      displayName: connectedServices.displayName,
      enabled: connectedServices.enabled,
    })
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, session.user.id),
        eq(connectedServices.enabled, true),
      ),
    );

  for (const svc of services) {
    const plugin = getPlugin(svc.type as ServiceType);
    if (!plugin?.widget) continue;

    available.push({
      widgetType: `plugin:${svc.type}`,
      displayName: plugin.widget.displayName,
      description: plugin.widget.description,
      icon: plugin.widget.icon,
      defaultWidth: plugin.widget.defaultWidth,
      defaultHeight: plugin.widget.defaultHeight,
      defaultConfig: { ...plugin.widget.defaultConfig, serviceId: svc.id },
      configFields: plugin.widget.configFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type as string,
        ...(f.options ? { options: f.options } : {}),
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      })),
      serviceId: svc.id,
    });
  }

  // ── 2. Automation widgets ──────────────────────────────────────────────────

  const userAutomations = await db
    .select({
      id: automations.id,
      name: automations.name,
      description: automations.description,
      enabled: automations.enabled,
    })
    .from(automations)
    .where(eq(automations.userId, session.user.id));

  for (const auto of userAutomations) {
    available.push({
      widgetType: "automation",
      displayName: auto.name,
      description: auto.description || "Run this automation from the dashboard.",
      icon: "Zap",
      defaultWidth: 220,
      defaultHeight: 140,
      defaultConfig: { automationId: auto.id },
      configFields: [],
      automationId: auto.id,
    });
  }

  return Response.json(available, {
    headers: { "Cache-Control": "no-store" },
  });
}
