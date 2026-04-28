/**
 * Microsoft Graph API client using client credentials (app-level) flow.
 * Allows Profession OS to read user mailboxes/calendars without per-user OAuth,
 * provided the Azure AD app has admin-consented Mail.Read and Calendars.Read
 * application permissions.
 *
 * Credentials are resolved from the explicitly supplied `creds` argument first,
 * falling back to the AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID /
 * AZURE_AD_CLIENT_SECRET environment variables. This lets each connected-service
 * record carry its own Azure AD application credentials rather than requiring a
 * shared server-side configuration.
 */

export interface AzureAdCredentials {
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  /**
   * Pre-obtained delegated OAuth access token.
   * When present, client credentials are skipped entirely and this token
   * is sent as-is in the Authorization header (delegated / on-behalf-of flow).
   */
  accessToken?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix ms
}

// Token cache keyed by "tenantId:clientId" so different Azure AD apps don't
// collide when multiple users connect their own app registrations.
const tokenCache = new Map<string, TokenCache>();

function tokenCacheKey(creds?: AzureAdCredentials): string {
  const tenantId = creds?.tenantId || process.env.AZURE_AD_TENANT_ID || "";
  const clientId = creds?.clientId || process.env.AZURE_AD_CLIENT_ID || "";
  return `${tenantId}:${clientId}`;
}

/**
 * Get an app-level access token for Microsoft Graph using client credentials.
 * Explicit `creds` override environment variables.
 * Tokens are cached in memory and refreshed 5 minutes before expiry.
 */
export async function getGraphAppToken(creds?: AzureAdCredentials): Promise<string> {
  const tenantId = creds?.tenantId || process.env.AZURE_AD_TENANT_ID;
  const clientId = creds?.clientId || process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = creds?.clientSecret || process.env.AZURE_AD_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    const missing = [
      !tenantId && "AZURE_AD_TENANT_ID",
      !clientId && "AZURE_AD_CLIENT_ID",
      !clientSecret && "AZURE_AD_CLIENT_SECRET",
    ].filter(Boolean);
    throw new Error(`Missing Azure AD credentials: ${missing.join(", ")}`);
  }

  const cacheKey = tokenCacheKey(creds);
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.accessToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get Graph app token: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const data = await response.json();
  const accessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;

  tokenCache.set(cacheKey, {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  });

  return accessToken;
}

/**
 * Build a descriptive error for a Graph 403 when using client credentials flow.
 */
function graph403AppError(path: string, body: string): Error {
  return new Error(
    `Graph API access denied (403) for ${path}. ` +
    `The Azure AD app likely lacks an Application-level permission with admin consent. ` +
    `In Azure Portal → App registrations → API permissions, add: ` +
    `"Mail.Read" (Application) for email, or "Calendars.Read" (Application) for calendar, ` +
    `then click "Grant admin consent". Original error: ${body}`
  );
}

/**
 * Build a descriptive error for a Graph 403 when using a delegated OAuth token.
 */
function graph403DelegatedError(path: string, body: string): Error {
  return new Error(
    `Graph API access denied (403) for ${path}. ` +
    `The OAuth token may lack the required scope (Mail.Read or Calendars.Read). ` +
    `Try disconnecting and reconnecting the service to re-authorise. Original error: ${body}`
  );
}

/**
 * Make an authenticated GET request to Microsoft Graph API.
 * Pass `creds` to use a specific Azure AD app registration instead of env vars.
 *
 * Delegated flow (creds.accessToken set): uses the token directly; no caching.
 * Client credentials flow: caches tokens and retries once on 403 (handles the
 * case where admin consent was just granted but the cached token predates it).
 */
export async function graphGet<T = unknown>(
  path: string,
  headers?: Record<string, string>,
  creds?: AzureAdCredentials
): Promise<T> {
  const url = path.startsWith("https://")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;

  const doRequest = (token: string): Promise<Response> =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
    });

  // ── Delegated OAuth token path ─────────────────────────────────────────────
  if (creds?.accessToken) {
    const response = await doRequest(creds.accessToken);
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 403) throw graph403DelegatedError(path, errorText);
      throw new Error(`Graph API error (${path}): ${response.status} ${response.statusText} — ${errorText}`);
    }
    return response.json() as Promise<T>;
  }

  // ── Client credentials path (with cache + retry on 403) ───────────────────
  const token = await getGraphAppToken(creds);
  let response = await doRequest(token);

  if (response.status === 403) {
    // Evict the cached token — it may predate a recent admin consent grant.
    // A fresh token will reflect any newly added application permissions.
    tokenCache.delete(tokenCacheKey(creds));
    const freshToken = await getGraphAppToken(creds);
    response = await doRequest(freshToken);
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) throw graph403AppError(path, errorText);
    throw new Error(`Graph API error (${path}): ${response.status} ${response.statusText} — ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Test connectivity to a specific user's mailbox.
 */
export async function testMailboxAccess(mailbox: string, creds?: AzureAdCredentials): Promise<boolean> {
  await graphGet(`/users/${mailbox}/mailFolders/inbox`, undefined, creds);
  return true;
}

/**
 * Test connectivity to a specific user's calendar.
 */
export async function testCalendarAccess(userEmail: string, creds?: AzureAdCredentials): Promise<boolean> {
  await graphGet(`/users/${userEmail}/calendars`, undefined, creds);
  return true;
}
