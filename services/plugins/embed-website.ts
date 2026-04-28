// Embed Website service plugin — displays any URL in an iframe inside the dashboard.
//
// This plugin has no activity feed. Its sole purpose is to register a URL
// that appears as a sidebar shortcut and renders in a full-screen iframe when
// selected. poll() always returns [] and testConnection() always returns true
// because URL reachability can't be validated server-side (CORS, auth walls, etc).

import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { registerPlugin } from "@/services/registry";

const embedWebsitePlugin: ServicePlugin = {
  type: ServiceType.EmbedWebsite,
  displayName: "Embed Website",
  description: "Embed any website as a full-screen panel accessible from the sidebar",
  icon: "Globe",
  color: "#6366F1",

  configFields: [
    {
      key: "url",
      label: "Website URL",
      type: "text",
      required: true,
      placeholder: "https://example.com",
      description: "The URL to embed. Must be HTTPS and allow framing (no X-Frame-Options: deny).",
    },
    {
      key: "openMode",
      label: "Open mode",
      type: "select",
      required: false,
      options: [
        { value: "embed", label: "Embed in dashboard" },
        { value: "new_tab", label: "Open in new tab" },
      ],
      description: "How the URL opens when you click this item in the sidebar.",
    },
  ],

  async poll(_config: ServiceConfig, _credentials: ServiceConfig): Promise<ActivityItemData[]> {
    // Embed services have no activity feed — they are purely display panels.
    return [];
  },

  async testConnection(_config: ServiceConfig, _credentials: ServiceConfig): Promise<boolean> {
    // URL accessibility cannot be validated server-side due to CORS and auth
    // restrictions on most sites. Accept any non-empty URL.
    const url = _config.url as string | undefined;
    return typeof url === "string" && url.trim().length > 0;
  },
};

registerPlugin(embedWebsitePlugin);
export default embedWebsitePlugin;
