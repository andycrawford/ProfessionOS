// Microsoft Graph OAuth authorization redirect.
// GET /api/auth/ms365-graph/authorize
//
// Redirects the user to Microsoft's OAuth consent screen using the org's
// Azure AD app registration. On success Microsoft redirects to the callback
// route which exchanges the code for tokens and creates the service record.
//
// For admin consent (grants delegated permission org-wide so individual users
// skip the consent dialog), pass adminConsent=true. Microsoft redirects to the
// callback with admin_consent=True — no code exchange is performed.
//
// Query params:
//   orgId        — ID of the SSO-enabled organisation to use
//   serviceType  — "ms365_email" or "ms365_calendar"
//   config       — JSON-serialised service config (mailbox, folders, etc.)
//   adminConsent — "true" to use the admin consent endpoint instead

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getOrgSsoConfigById } from "@/lib/sso";

const GRAPH_SCOPES: Record<string, string> = {
  ms365_email:    "https://graph.microsoft.com/Mail.Read offline_access openid profile",
  ms365_calendar: "https://graph.microsoft.com/Calendars.Read offline_access openid profile",
};

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    const origin = new URL(req.url).origin;
    return Response.redirect(`${origin}/sign-in`);
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const serviceType = url.searchParams.get("serviceType");
  const configJson = url.searchParams.get("config") ?? "{}";
  const adminConsent = url.searchParams.get("adminConsent") === "true";

  if (!orgId || !serviceType) {
    return Response.json({ error: "orgId and serviceType are required" }, { status: 400 });
  }

  const ssoOrg = await getOrgSsoConfigById(orgId);
  if (!ssoOrg) {
    return Response.json({ error: "SSO organization not found or not configured" }, { status: 404 });
  }

  const scope = GRAPH_SCOPES[serviceType];
  if (!scope) {
    return Response.json({ error: `Unknown serviceType: ${serviceType}` }, { status: 400 });
  }

  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || url.origin;
  const redirectUri = `${origin}/api/auth/ms365-graph/callback`;

  // State encodes everything needed to create the service record in the callback.
  // userId is included so the callback can verify the session hasn't changed (CSRF).
  const state = Buffer.from(
    JSON.stringify({
      orgId,
      serviceType,
      config: JSON.parse(configJson),
      userId: session.user.id,
    })
  ).toString("base64url");

  if (adminConsent) {
    // Admin consent endpoint — grants delegated permission for all users in the tenant.
    // Microsoft redirects back with admin_consent=True (no code to exchange).
    const adminUrl = new URL(
      `https://login.microsoftonline.com/${ssoOrg.tenantId}/v2.0/adminconsent`
    );
    adminUrl.searchParams.set("client_id", ssoOrg.clientId);
    adminUrl.searchParams.set("scope", scope);
    adminUrl.searchParams.set("redirect_uri", redirectUri);
    adminUrl.searchParams.set("state", state);
    return Response.redirect(adminUrl.toString());
  }

  // Standard authorization code flow
  const authUrl = new URL(
    `https://login.microsoftonline.com/${ssoOrg.tenantId}/oauth2/v2.0/authorize`
  );
  authUrl.searchParams.set("client_id", ssoOrg.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString());
}
