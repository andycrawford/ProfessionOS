import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices, automations } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import ServiceDetailShell from "@/app/dashboard/_components/ServiceDetailShell";
import AutomationPanel from "./_components/AutomationPanel";
import type { AutomationRow } from "./_components/AutomationPanel";

export default async function CodePage() {
  const session = await safeAuth();

  if (!session?.user?.id) {
    return <ServiceDetailShell service="code" />;
  }

  const db = getDb();
  const userId = session.user.id;

  // Find any code_automation plugins the user has connected
  const allServices = await db
    .select({ id: connectedServices.id, type: connectedServices.type, displayName: connectedServices.displayName, config: connectedServices.config })
    .from(connectedServices)
    .where(and(eq(connectedServices.userId, userId), eq(connectedServices.enabled, true)));

  const codeAutomationServices = allServices.filter((s) => s.type === "code_automation");

  // If no automation plugin, show standard shell
  if (codeAutomationServices.length === 0) {
    return <ServiceDetailShell service="code" />;
  }

  // Load automations for the first connected plugin
  const plugin = codeAutomationServices[0];
  const rows = await db
    .select()
    .from(automations)
    .where(and(eq(automations.userId, userId), eq(automations.pluginServiceId, plugin.id)))
    .orderBy(desc(automations.createdAt));

  const automationRows: AutomationRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    triggerType: r.triggerType,
    enabled: r.enabled,
    writeMode: r.writeMode,
    actionConfig: r.actionConfig as Record<string, unknown>,
    aiConversationId: r.aiConversationId ?? null,
    lastRunAt: r.lastRunAt?.toISOString() ?? null,
    lastRunStatus: r.lastRunStatus ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  // Determine the AI service ID from plugin config
  const pluginConfig = plugin.config as Record<string, unknown>;
  const aiServiceId = typeof pluginConfig.aiServiceId === "string" ? pluginConfig.aiServiceId : null;

  return (
    <AutomationPanel
      pluginServiceId={plugin.id}
      pluginDisplayName={plugin.displayName}
      aiServiceId={aiServiceId}
      initialAutomations={automationRows}
    />
  );
}
