// GET /api/auth/netsuite/authorize
//
// Initiates the NetSuite OAuth 2.0 Authorization Code flow.
// Builds a signed state token and redirects the user to the NetSuite consent screen.
//
// Query params:
//   accountId   (required) — NetSuite account ID (e.g. "1234567" or "1234567-SB1")
//   displayName (optional) — label for the new service record (default: "NetSuite CRM")
//   serviceId   (optional) — existing service ID when re-authorizing a connected service

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { signState, buildNetSuiteAuthUrl } from "@/lib/netsuite-oauth";

export async function GET(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    // Redirect to sign-in if not authenticated; return URL will bring them back.
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return Response.redirect(signInUrl.toString());
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  const displayName = (url.searchParams.get("displayName")?.trim() || "NetSuite CRM");
  const serviceId = url.searchParams.get("serviceId") ?? undefined;

  if (!accountId) {
    return Response.json({ error: "accountId query parameter is required" }, { status: 400 });
  }

  if (!process.env.NETSUITE_CLIENT_ID) {
    return Response.json(
      { error: "NetSuite OAuth is not configured on this server (NETSUITE_CLIENT_ID missing)" },
      { status: 503 }
    );
  }

  // Embed a nonce in state so we can detect replay/CSRF on callback
  const state = signState({
    userId: session.user.id,
    accountId,
    displayName,
    nonce: crypto.randomUUID(),
    serviceId,
  });

  const authUrl = buildNetSuiteAuthUrl(accountId, state);
  return Response.redirect(authUrl);
}
