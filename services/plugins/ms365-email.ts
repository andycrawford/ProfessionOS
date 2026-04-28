import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { graphGet, testMailboxAccess } from "@/lib/microsoft-graph";
import type { AzureAdCredentials } from "@/lib/microsoft-graph";
import { getOrgSsoConfigById } from "@/lib/sso";
import { registerPlugin } from "@/services/registry";

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  importance?: string;
  isRead?: boolean;
  bodyPreview?: string;
  webLink?: string;
  hasAttachments?: boolean;
  flag?: { flagStatus?: string };
}

interface GraphMessageResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
}

async function getAzureCreds(config: ServiceConfig, credentials: ServiceConfig): Promise<AzureAdCredentials> {
  if (config.configSource === "sso_org") {
    const orgId = config.ssoOrgId as string | undefined;
    if (!orgId) throw new Error("An Organization must be selected when using SSO credentials");
    const ssoOrg = await getOrgSsoConfigById(orgId);
    if (!ssoOrg) throw new Error(`SSO organization not found or not configured (id: ${orgId})`);
    return {
      tenantId: ssoOrg.tenantId,
      clientId: ssoOrg.clientId,
      clientSecret: ssoOrg.clientSecret,
    };
  }
  return {
    tenantId: (credentials.tenantId as string) || (config.tenantId as string) || undefined,
    clientId: (credentials.clientId as string) || (config.clientId as string) || undefined,
    clientSecret: (credentials.clientSecret as string) || (config.clientSecret as string) || undefined,
  };
}

const ms365EmailPlugin: ServicePlugin = {
  type: ServiceType.Ms365Email,
  displayName: "Microsoft 365 Email",
  description: "Monitor Microsoft 365 / Outlook mailboxes for important emails",
  icon: "Mail",
  color: "#0078D4",
  configFields: [
    {
      key: "configSource",
      label: "Credential source",
      type: "select",
      required: true,
      description: "Use manually entered credentials or pull from an Organization SSO configuration",
      options: [
        { label: "Enter credentials manually", value: "manual" },
        { label: "Use Organization SSO", value: "sso_org" },
      ],
    },
    // ── SSO path ──────────────────────────────────────────────────────────────
    {
      key: "ssoOrgId",
      label: "Organization",
      type: "dynamic-select",
      required: false,
      endpoint: "/api/organizations/sso-orgs",
      description: "Organization whose SSO credentials will be used to access the mailbox",
      visibleWhen: { field: "configSource", value: "sso_org" },
    },
    // ── Manual path ───────────────────────────────────────────────────────────
    {
      key: "tenantId",
      label: "Azure AD Tenant ID",
      type: "text",
      required: false,
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      description: "Your Azure AD (Entra ID) tenant/directory ID",
      visibleWhen: { field: "configSource", value: "manual" },
    },
    {
      key: "clientId",
      label: "Azure AD Client ID",
      type: "text",
      required: false,
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      description: "Application (client) ID of your registered Azure AD app",
      visibleWhen: { field: "configSource", value: "manual" },
    },
    {
      key: "clientSecret",
      label: "Azure AD Client Secret",
      type: "password",
      required: false,
      placeholder: "your-client-secret-value",
      description: "Client secret for your Azure AD app (requires Mail.Read application permission)",
      visibleWhen: { field: "configSource", value: "manual" },
    },
    // ── Common fields (always shown) ──────────────────────────────────────────
    {
      key: "mailbox",
      label: "Mailbox Address",
      type: "email",
      required: true,
      placeholder: "user@company.com",
      description: "The email address to monitor",
    },
    {
      key: "folders",
      label: "Folders to Monitor",
      type: "text",
      required: false,
      placeholder: "Inbox",
      description: "Comma-separated folder names (default: Inbox)",
    },
    {
      key: "lookbackHours",
      label: "Lookback Window (hours)",
      type: "number",
      required: false,
      placeholder: "24",
      description: "How far back to look for emails on each poll",
    },
    {
      key: "unreadOnly",
      label: "Unread Only",
      type: "select",
      required: false,
      placeholder: "false",
      description: "Only fetch unread messages",
      options: [
        { label: "All messages", value: "false" },
        { label: "Unread only", value: "true" },
      ],
    },
  ],

  async poll(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const mailbox = config.mailbox as string;
    if (!mailbox) throw new Error("Mailbox address is required");

    const lookbackHours = (config.lookbackHours as number) || 24;
    const since = new Date(
      Date.now() - lookbackHours * 60 * 60 * 1000
    ).toISOString();
    const unreadOnly = config.unreadOnly === "true";

    let filter = `receivedDateTime ge ${since}`;
    if (unreadOnly) filter += " and isRead eq false";

    const endpoint = `/users/${mailbox}/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,importance,isRead,bodyPreview,webLink,hasAttachments,flag`;

    const creds = await getAzureCreds(config, credentials);
    const data = await graphGet<GraphMessageResponse>(endpoint, undefined, creds);
    const messages = data.value || [];

    return messages.map((msg): ActivityItemData => {
      const importance = msg.importance || "normal";
      const isFlagged = msg.flag?.flagStatus === "flagged";

      let urgency: 0 | 1 | 2 = 0;
      if (importance === "high" || isFlagged) urgency = 2;
      else if (importance === "low") urgency = 0;

      return {
        externalId: msg.id,
        itemType: "email",
        title: msg.subject || "(No Subject)",
        summary: msg.bodyPreview || undefined,
        urgency,
        sourceUrl: msg.webLink || undefined,
        metadata: {
          from: msg.from?.emailAddress?.address,
          fromName: msg.from?.emailAddress?.name,
          isRead: msg.isRead,
          importance,
          hasAttachments: msg.hasAttachments,
          isFlagged,
        },
        occurredAt: msg.receivedDateTime
          ? new Date(msg.receivedDateTime)
          : undefined,
      };
    });
  },

  async testConnection(config: ServiceConfig, credentials: ServiceConfig): Promise<boolean> {
    const mailbox = config.mailbox as string;
    if (!mailbox) return false;
    const creds = await getAzureCreds(config, credentials);
    return testMailboxAccess(mailbox, creds);
  },
};

registerPlugin(ms365EmailPlugin);
export default ms365EmailPlugin;
