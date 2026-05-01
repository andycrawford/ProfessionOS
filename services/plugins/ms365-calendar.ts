import type { ServicePlugin, ActivityItemData, ServiceConfig } from "@/services/types";
import { ServiceType } from "@/services/types";
import { graphGet, testCalendarAccess } from "@/lib/microsoft-graph";
import type { AzureAdCredentials } from "@/lib/microsoft-graph";
import { getOrgSsoConfigById } from "@/lib/sso";
import { registerPlugin } from "@/services/registry";

interface GraphEvent {
  id: string;
  subject?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  importance?: string;
  isAllDay?: boolean;
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  webLink?: string;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  responseStatus?: { response?: string };
  sensitivity?: string;
}

interface GraphEventResponse {
  value: GraphEvent[];
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

const ms365CalendarPlugin: ServicePlugin = {
  type: ServiceType.Ms365Calendar,
  displayName: "Microsoft 365 Calendar",
  description: "Monitor Microsoft 365 / Outlook calendar events and meetings",
  icon: "Calendar",
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
      description: "Client secret for your Azure AD app (requires Calendars.Read application permission)",
      visibleWhen: { field: "configSource", value: "manual" },
    },
    // ── Common fields (always shown) ──────────────────────────────────────────
    {
      key: "userEmail",
      label: "User Email",
      type: "email",
      required: true,
      placeholder: "user@company.com",
      description: "The user whose calendar to monitor",
    },
    {
      key: "lookaheadHours",
      label: "Lookahead Window (hours)",
      type: "number",
      required: false,
      placeholder: "48",
      description: "How far ahead to look for upcoming events",
    },
    {
      key: "includeCancelled",
      label: "Include Cancelled",
      type: "select",
      required: false,
      description: "Show cancelled events in the dashboard",
      options: [
        { label: "Hide cancelled", value: "false" },
        { label: "Show cancelled", value: "true" },
      ],
    },
  ],

  async poll(
    config: ServiceConfig,
    credentials: ServiceConfig
  ): Promise<ActivityItemData[]> {
    const userEmail = config.userEmail as string;
    if (!userEmail) throw new Error("User email is required");

    const lookaheadHours = (config.lookaheadHours as number) || 48;
    const now = new Date();
    const end = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
    const includeCancelled = config.includeCancelled === "true";

    const endpoint = `/users/${userEmail}/calendarview?startDateTime=${now.toISOString()}&endDateTime=${end.toISOString()}&$top=50&$orderby=start/dateTime&$select=id,subject,start,end,importance,isAllDay,location,organizer,webLink,isCancelled,isOnlineMeeting,onlineMeetingUrl,responseStatus,sensitivity`;

    const creds = await getAzureCreds(config, credentials);
    const data = await graphGet<GraphEventResponse>(endpoint, {
      Prefer: 'outlook.timezone="UTC"',
    }, creds);

    let events = data.value || [];

    if (!includeCancelled) {
      events = events.filter((evt) => !evt.isCancelled);
    }

    return events.map((evt): ActivityItemData => {
      const startDate = evt.start?.dateTime
        ? new Date(evt.start.dateTime + "Z") // Graph returns UTC when Prefer header is set
        : new Date();
      const minutesUntil = (startDate.getTime() - Date.now()) / (1000 * 60);
      const importance = evt.importance || "normal";

      // Urgency: high importance or starting within 30 min → urgent (2)
      // Starting within 2 hours → important (1), otherwise normal (0)
      let urgency: 0 | 1 | 2 = 0;
      if (importance === "high" || minutesUntil <= 30) urgency = 2;
      else if (minutesUntil <= 120) urgency = 1;

      const parts: string[] = [];
      if (evt.location?.displayName) parts.push(evt.location.displayName);
      if (evt.isOnlineMeeting) parts.push("Online meeting");
      if (evt.isCancelled) parts.push("CANCELLED");
      const summary = parts.length > 0 ? parts.join(" · ") : undefined;

      return {
        externalId: evt.id,
        itemType: "calendar_event",
        title: evt.subject || "(No Subject)",
        summary,
        urgency,
        sourceUrl: evt.webLink || evt.onlineMeetingUrl || undefined,
        metadata: {
          startTime: evt.start?.dateTime,
          endTime: evt.end?.dateTime,
          isAllDay: evt.isAllDay,
          location: evt.location?.displayName,
          organizer: evt.organizer?.emailAddress?.name,
          organizerEmail: evt.organizer?.emailAddress?.address,
          isCancelled: evt.isCancelled,
          isOnlineMeeting: evt.isOnlineMeeting,
          onlineMeetingUrl: evt.onlineMeetingUrl,
          responseStatus: evt.responseStatus?.response,
          sensitivity: evt.sensitivity,
        },
        occurredAt: startDate,
      };
    });
  },

  async testConnection(config: ServiceConfig, credentials: ServiceConfig): Promise<boolean> {
    const userEmail = config.userEmail as string;
    if (!userEmail) return false;
    const creds = await getAzureCreds(config, credentials);
    return testCalendarAccess(userEmail, creds);
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
      || "https://graph.microsoft.com/Calendars.Read offline_access";

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
      console.error(`[ms365-calendar] Token refresh failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string | undefined) || refreshToken,
      expiresAt: Date.now() + ((data.expires_in as number) || 3600) * 1000,
      scope,
    };
  },

  widget: {
    displayName: "Calendar",
    description: "Upcoming events from your connected Microsoft 365 calendar.",
    icon: "Calendar",
    defaultWidth: 280,
    defaultHeight: 200,
    defaultConfig: {},
    configFields: [],
  },
};

registerPlugin(ms365CalendarPlugin);
export default ms365CalendarPlugin;
