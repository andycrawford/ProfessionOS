// Microsoft Graph OAuth callback.
// GET /api/auth/ms365-graph/callback
//
// Handles two outcomes from Microsoft:
//   1. Admin consent grant  — admin_consent=True param, no code exchange needed.
//      Redirects to the new-service page with a success banner.
//   2. Authorization code  — exchanges code for access + refresh tokens, then
//      inserts a connected-service record and redirects to its detail page.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { getOrgSsoConfigById } from "@/lib/sso";

const DISPLAY_NAMES: Record<string, string> = {
  ms365_email:    "Microsoft 365 Email",
  ms365_calendar: "Microsoft 365 Calendar",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL || url.origin;
  const newServiceBase = `${origin}/dashboard/settings/services/new`;

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const adminConsentParam = url.searchParams.get("admin_consent");
  const errorParam = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  // ── Error from Microsoft ───────────────────────────────────────────────────
  if (errorParam) {
    return Response.redirect(
      `${newServiceBase}?error=${encodeURIComponent(errorDesc || errorParam)}`
    );
  }

  // ── Admin consent callback ─────────────────────────────────────────────────
  // Microsoft redirects with admin_consent=True when an admin grants org-wide
  // delegated permission. No code to exchange — just surface a success message.
  if (adminConsentParam === "True") {
    return Response.redirect(
      `${newServiceBase}?info=${encodeURIComponent(
        "Admin consent granted. Your organisation's users can now connect without a consent dialog."
      )}`
    );
  }

  // ── Authorization code callback ────────────────────────────────────────────
  if (!code || !stateParam) {
    return Response.redirect(`${newServiceBase}?error=missing_code`);
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return Response.redirect(`${origin}/sign-in`);
  }

  // Decode state
  type StateData = {
    orgId: string;
    serviceType: string;
    config: Record<string, unknown>;
    userId: string;
  };
  let state: StateData;
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8")) as StateData;
  } catch {
    return Response.redirect(`${newServiceBase}?error=invalid_state`);
  }

  // CSRF: verify the authorising user is still the signed-in user
  if (state.userId !== session.user.id) {
    return Response.redirect(`${newServiceBase}?error=state_mismatch`);
  }

  const ssoOrg = await getOrgSsoConfigById(state.orgId);
  if (!ssoOrg) {
    return Response.redirect(`${newServiceBase}?error=org_not_found`);
  }

  const redirectUri = `${origin}/api/auth/ms365-graph/callback`;

  // Exchange authorization code for tokens
  const tokenUrl = `https://login.microsoftonline.com/${ssoOrg.tenantId}/oauth2/v2.0/token`;
  const tokenBody = new URLSearchParams({
    client_id: ssoOrg.clientId,
    client_secret: ssoOrg.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return Response.redirect(
      `${newServiceBase}?error=${encodeURIComponent(`Token exchange failed: ${errText}`)}`
    );
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  // Build config: merge form values with the credential source markers
  const config = {
    ...state.config,
    configSource: "oauth",
    ssoOrgId: state.orgId,
  };

  const credentials = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    scope: tokens.scope ?? null,
  };

  const displayName = DISPLAY_NAMES[state.serviceType] ?? state.serviceType;

  const db = getDb();
  const [service] = await db
    .insert(connectedServices)
    .values({
      userId: session.user.id,
      type: state.serviceType,
      displayName,
      config,
      credentials,
      enabled: true,
      status: "ok",
    })
    .returning();

  return Response.redirect(`${origin}/dashboard/settings/services/${service.id}`);
}
