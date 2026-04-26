/**
 * Microsoft Graph API client using client credentials (app-level) flow.
 * Allows Profession OS to read user mailboxes/calendars without per-user OAuth,
 * provided the Azure AD app has admin-consented Mail.Read and Calendars.Read
 * application permissions.
 */

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let cachedToken: TokenCache | null = null;

/**
 * Get an app-level access token for Microsoft Graph using client credentials.
 * Tokens are cached in memory and refreshed 5 minutes before expiry.
 */
export async function getGraphAppToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt - now > 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    const missing = [
      !tenantId && "AZURE_AD_TENANT_ID",
      !clientId && "AZURE_AD_CLIENT_ID",
      !clientSecret && "AZURE_AD_CLIENT_SECRET",
    ].filter(Boolean);
    throw new Error(`Missing Azure AD credentials: ${missing.join(", ")}`);
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

  cachedToken = {
    accessToken,
    expiresAt: now + expiresIn * 1000,
  };

  return accessToken;
}

/**
 * Make an authenticated GET request to Microsoft Graph API.
 */
export async function graphGet<T = unknown>(
  path: string,
  headers?: Record<string, string>
): Promise<T> {
  const token = await getGraphAppToken();

  const url = path.startsWith("https://")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Graph API error (${path}): ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Test connectivity to a specific user's mailbox.
 */
export async function testMailboxAccess(mailbox: string): Promise<boolean> {
  await graphGet(`/users/${mailbox}/mailFolders/inbox`);
  return true;
}

/**
 * Test connectivity to a specific user's calendar.
 */
export async function testCalendarAccess(userEmail: string): Promise<boolean> {
  await graphGet(`/users/${userEmail}/calendars`);
  return true;
}
