// GET /api/auth/netsuite/callback
//
// Handles the OAuth 2.0 redirect from NetSuite after the user authorizes the app.
// Exchanges the authorization code for access + refresh tokens, persists them in
// connectedServices.credentials, and redirects the user to the service detail page.
//
// On error, redirects to /dashboard/settings/services/new with an ?error= query param
// so the UI can surface a human-readable message.

export const dynamic = "force-dynamic";

import { safeAuth } from "@/auth";
import { verifyState, exchangeCodeForTokens } from "@/lib/netsuite-oauth";
import { getDb } from "@/db";
import { connectedServices } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

function errorRedirect(msg: string): Response {
  const dest = new URL("/dashboard/settings/services/new", BASE_URL);
  dest.searchParams.set("error", msg);
  return Response.redirect(dest.toString());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // NetSuite denied access or returned an error
  if (oauthError) {
    return errorRedirect(oauthError);
  }

  if (!code || !stateParam) {
    return errorRedirect("missing_params");
  }

  // Verify HMAC signature and parse state
  const state = verifyState(stateParam);
  if (!state) {
    return errorRedirect("invalid_state");
  }

  // Confirm the session matches the user who started the flow (CSRF guard)
  const session = await safeAuth();
  if (!session?.user?.id || session.user.id !== state.userId) {
    return errorRedirect("session_mismatch");
  }

  try {
    const tokens = await exchangeCodeForTokens(state.accountId, code);

    const credentials = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };

    const db = getDb();
    let serviceId: string;

    if (state.serviceId) {
      // Re-authorization — update credentials on the existing service record
      const [updated] = await db
        .update(connectedServices)
        .set({ credentials, status: "ok", lastError: null })
        .where(
          and(
            eq(connectedServices.id, state.serviceId),
            eq(connectedServices.userId, state.userId)
          )
        )
        .returning({ id: connectedServices.id });

      if (!updated) {
        return errorRedirect("service_not_found");
      }
      serviceId = updated.id;
    } else {
      // New connection — create the service record
      const [created] = await db
        .insert(connectedServices)
        .values({
          userId: state.userId,
          type: "netsuite_crm",
          displayName: state.displayName,
          // accountId goes in config (non-secret); tokens go in credentials
          config: { accountId: state.accountId },
          credentials,
          enabled: true,
          status: "ok",
        })
        .returning({ id: connectedServices.id });

      serviceId = created.id;
    }

    const dest = new URL(`/dashboard/settings/services/${serviceId}`, BASE_URL);
    return Response.redirect(dest.toString());
  } catch (err) {
    console.error("[netsuite-oauth] callback error:", err);
    const msg = err instanceof Error ? err.message : "unknown_error";
    return errorRedirect(msg.slice(0, 200));
  }
}
