import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

// Code Automation plugin — a user-facing automation engine backed by an AI service.
// The plugin itself does not poll external services; automations produce activity items
// via the automation run executor (app/api/automations/[id]/run/route.ts).
// The configFields drive the service connection form in Settings → Services.

const codeAutomationPlugin: ServicePlugin = {
  type: ServiceType.CodeAutomation,
  displayName: "Code Automation",
  description: "Build AI-assisted automations that act on your connected services",
  icon: "Zap",
  color: "#7C3AED",
  configFields: [
    {
      key: "aiServiceId",
      label: "AI Service",
      type: "dynamic-select",
      required: true,
      // Fetches connected AI-capable services (claude_ai and future OpenAI/Gemini plugins)
      endpoint: "/api/services/ai-options",
      description: "The AI service used to generate and evaluate automation actions",
    },
    {
      key: "defaultModel",
      label: "Default Model",
      type: "text",
      required: false,
      placeholder: "claude-sonnet-4-6",
      description: "Override the default model for this automation plugin (optional)",
    },
  ],

  // The plugin itself returns no items — automations produce items via the run executor.
  async poll(_config: ServiceConfig, _credentials: ServiceConfig): Promise<ActivityItemData[]> {
    return [];
  },

  // Verify the referenced AI service is reachable.
  // We delegate to the AI service's own testConnection during setup; here we just
  // confirm the config is non-empty (the actual key validation happens at run time).
  async testConnection(config: ServiceConfig, _credentials: ServiceConfig): Promise<boolean> {
    return typeof config.aiServiceId === "string" && config.aiServiceId.length > 0;
  },
};

registerPlugin(codeAutomationPlugin);
export default codeAutomationPlugin;
