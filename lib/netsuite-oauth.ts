// NetSuite OAuth 2.0 Authorization Code flow helpers.
//
// Required env vars:
//   NETSUITE_CLIENT_ID      — OAuth 2.0 client ID from the NetSuite Integration record
//   NETSUITE_CLIENT_SECRET  — client secret from the same Integration record
//   AUTH_URL                — base URL of this app (e.g. https://app.professionos.com)
//   AUTH_SECRET             — used to sign the OAuth state parameter (falls back to this)
//
// NetSuite Integration setup:
//   Setup > Integration > Manage Integrations > New
//   Enable "Token-Based Authentication" and "AUTHORIZATION CODE GRANT" OAuth 2.0.
//   Set redirect URI to: {AUTH_URL}/api/auth/netsuite/callback
//   Scopes: rest_webservices

import { createHmac, timingSafeEqual } from "crypto";

const STATE_SECRET = process.env.AUTH_SECRET ?? "dev-fallback-secret";
const REDIRECT_URI = `${process.env.AUTH_URL ?? "http://localhost:3000"}/api/auth/netsuite/callback`;

// ── Account URL helpers ───────────────────────────────────────────────────────
// NetSuite uses the account ID in hostnames, replacing underscores with hyphens
// and lowercasing. Sandbox: "12345678-SB1" → "12345678-sb1"; prod: "12345678".

function urlAccount(accountId: string): string {
  return accountId.replace(/_/g, "-").toLowerCase();
}

// ── OAuth state (HMAC-signed, base64url-encoded) ──────────────────────────────

export interface NetSuiteOAuthState {
  userId: string;
  accountId: string;
  displayName: string;
  nonce: string;
  /** serviceId — present when re-authorizing an existing service record */
  serviceId?: string;
}

export function signState(state: NetSuiteOAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyState(signed: string): NetSuiteOAuthState | null {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;

  const payload = signed.slice(0, dot);
  const sig = Buffer.from(signed.slice(dot + 1), "base64url");
  const expected = Buffer.from(
    createHmac("sha256", STATE_SECRET).update(payload).digest("base64url"),
    "base64url"
  );

  // Timing-safe comparison to prevent HMAC oracle attacks
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as NetSuiteOAuthState;
  } catch {
    return null;
  }
}

// ── Authorization URL ─────────────────────────────────────────────────────────

export function buildNetSuiteAuthUrl(accountId: string, state: string): string {
  const clientId = process.env.NETSUITE_CLIENT_ID;
  if (!clientId) throw new Error("NETSUITE_CLIENT_ID is not set");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: "rest_webservices",
    state,
  });

  return `https://${urlAccount(accountId)}.app.netsuite.com/app/login/oauth2/authorize?${params}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface NetSuiteTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms timestamp when the access token expires */
  expiresAt: number;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

async function postToTokenEndpoint(
  accountId: string,
  body: URLSearchParams
): Promise<RawTokenResponse> {
  const clientId = process.env.NETSUITE_CLIENT_ID;
  const clientSecret = process.env.NETSUITE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NETSUITE_CLIENT_ID and NETSUITE_CLIENT_SECRET must be set");
  }

  const tokenUrl = `https://${urlAccount(accountId)}.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token`;

  // NetSuite supports HTTP Basic auth for client credentials in addition to the
  // body params; the body approach is simpler across clients.
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NetSuite token endpoint ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<RawTokenResponse>;
}

function rawToTokens(raw: RawTokenResponse): NetSuiteTokens {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    // Add a 60-second buffer so we refresh slightly before expiry
    expiresAt: Date.now() + (raw.expires_in - 60) * 1000,
  };
}

export async function exchangeCodeForTokens(
  accountId: string,
  code: string
): Promise<NetSuiteTokens> {
  const raw = await postToTokenEndpoint(
    accountId,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    })
  );
  return rawToTokens(raw);
}

export async function refreshAccessToken(
  accountId: string,
  refreshToken: string
): Promise<NetSuiteTokens> {
  const raw = await postToTokenEndpoint(
    accountId,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
  return rawToTokens(raw);
}
