import Anthropic from "@anthropic-ai/sdk";
import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

const claudeAiPlugin: ServicePlugin = {
  type: ServiceType.ClaudeAi,
  displayName: "Claude AI",
  description: "Enable real AI chat with your Anthropic API key and dashboard context injection",
  icon: "Bot",
  color: "#D97757",
  configFields: [
    {
      key: "apiKey",
      label: "Anthropic API Key",
      type: "password",
      required: true,
      placeholder: "sk-ant-...",
      description: "Your personal Anthropic API key from console.anthropic.com",
    },
    {
      key: "model",
      label: "Model",
      type: "select",
      required: true,
      options: [
        { label: "Claude Opus 4.6", value: "claude-opus-4-6" },
        { label: "Claude Sonnet 4.6 (recommended)", value: "claude-sonnet-4-6" },
        { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001" },
      ],
      description: "Which Claude model to use for chat responses",
    },
    {
      key: "contextItemLimit",
      label: "Context Item Limit",
      type: "number",
      required: false,
      placeholder: "20",
      description: "How many activity items to inject as context (default: 20)",
    },
  ],

  // Claude is reactive, not polled — no activity items to return.
  async poll(_config: ServiceConfig, _credentials: ServiceConfig): Promise<ActivityItemData[]> {
    return [];
  },

  async testConnection(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<boolean> {
    const apiKey = (credentials.apiKey as string) || (config.apiKey as string);
    if (!apiKey) return false;

    const client = new Anthropic({ apiKey });
    // Minimal call — just enough tokens to verify the key is valid.
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return response.id !== undefined;
  },
};

registerPlugin(claudeAiPlugin);
export default claudeAiPlugin;
