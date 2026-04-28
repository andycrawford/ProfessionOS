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
  if (config.configSource === "oauth") {
    const accessToken = credentials.access_token as string | undefined;
    if (!accessToken) throw new Error("No OAuth access token found. Please disconnect and reconnect the service.");
    return { accessToken };
  }
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
  // Manual mode (or legacy config without configSource)
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
  oauthSourceField: "configSource",
  oauthAuthorizeEndpoint: "/api/auth/ms365-graph/authorize",
  configFields: [
    {
      key: "configSource",
      label: "Credential source",
      type: "select",
      required: true,
      description: "How Profession OS authenticates to Microsoft Graph API",
      options: [
        { label: "Enter credentials manually", value: "manual" },
        { label: "Use Organization SSO (requires Application permission + admin consent)", value: "sso_org" },
        { label: "Sign in with Microsoft (OAuth — no admin consent required)", value: "oauth" },
      ],
    },
    // ── SSO / OAuth org picker (shown for both sso_org and oauth modes) ────────
    {
      key: "ssoOrgId",
      label: "Organization",
      type: "dynamic-select",
      required: false,
      endpoint: "/api/organizations/sso-orgs",
      description: "Organization whose Azure AD app is used. For OAuth mode, also register the redirect URI shown below in your Azure app.",
      visibleWhen: { field: "configSource", values: ["sso_org", "oauth"] },
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

  async refreshCredentials(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ServiceConfig | null> {
    if (config.configSource !== "oauth") return null;

    const refreshToken = credentials.refresh_token as string | undefined;
    const expiresAt = credentials.expiresAt as number | undefined;
    if (!refreshToken) return null;

    // Skip refresh if the current token still has more than 5 minutes left
    if (expiresAt && Date.now() < expiresAt - 5 * 60 * 1000) return null;

    const orgId = config.ssoOrgId as string | undefined;
    if (!orgId) return null;

    const ssoOrg = await getOrgSsoConfigById(orgId);
    if (!ssoOrg) return null;

    const scope = (credentials.scope as string | undefined)
      || "https://graph.microsoft.com/Mail.Read offline_access";

    const tokenUrl = `https://login.microsoftonline.com/${ssoOrg.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: ssoOrg.clientId,
      client_secret: ssoOrg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope,
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      console.error(`[ms365-email] Token refresh failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    return {
      access_token: data.access_token as string,
      // Microsoft may or may not return a new refresh token; preserve the old one if absent
      refresh_token: (data.refresh_token as string | undefined) || refreshToken,
      expiresAt: Date.now() + ((data.expires_in as number) || 3600) * 1000,
      scope,
    };
  },
};

registerPlugin(ms365EmailPlugin);
export default ms365EmailPlugin;
