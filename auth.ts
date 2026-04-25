import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

/**
 * NextAuth v5 configuration for Profession OS.
 *
 * Session strategy: database (sessions stored in Postgres via DrizzleAdapter,
 * not JWTs). This enables server-side invalidation at the cost of one DB
 * lookup per authenticated request.
 *
 * Providers: Google, Microsoft Entra ID (personal + org accounts), Apple.
 * Client IDs and secrets are auto-inferred from AUTH_* env vars — see
 * .env.local.example for the full list.
 *
 * OAuth app setup:
 *   Google    — https://console.cloud.google.com → APIs & Services → Credentials
 *               Authorized redirect URI: {AUTH_URL}/api/auth/callback/google
 *
 *   Microsoft — https://portal.azure.com → Azure Active Directory → App registrations
 *               Redirect URI: {AUTH_URL}/api/auth/callback/microsoft-entra-id
 *               Set AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="common" for personal + org
 *               accounts (default), or a specific tenant ID for single-org access.
 *
 *   Apple     — https://developer.apple.com → Certificates, IDs & Profiles →
 *               Services → Sign In with Apple
 *               Redirect URI: {AUTH_URL}/api/auth/callback/apple
 *               Apple requires HTTPS — does not work on http://localhost.
 *               Generate the P8 private key JWT with: npx auth add apple
 */
// Build-time guard: DrizzleAdapter inspects the db object's prototype chain at
// creation time (via drizzle-orm `is()`), so it cannot be constructed at module
// evaluation when DATABASE_URL may be absent (e.g. during `next build`).
// Wrapping each adapter method defers getDb() to the first request.
let _adapter: Adapter | undefined;
function lazyAdapter(): Adapter {
  if (!_adapter) {
    _adapter = DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }) as Adapter;
  }
  return _adapter;
}

const adapter: Adapter = new Proxy({} as Adapter, {
  get(_target, prop: string) {
    return Reflect.get(lazyAdapter(), prop);
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: {
    strategy: "database",
  },
  providers: [
    // Auto-infers clientId from AUTH_GOOGLE_ID, clientSecret from AUTH_GOOGLE_SECRET
    Google,

    // Auto-infers clientId from AUTH_MICROSOFT_ENTRA_ID_ID,
    // clientSecret from AUTH_MICROSOFT_ENTRA_ID_SECRET.
    // Issuer defaults to "common" (personal + org Microsoft accounts).
    // Pass a tenant ID via AUTH_MICROSOFT_ENTRA_ID_TENANT_ID to restrict to one org.
    MicrosoftEntraID({
      issuer:
        process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID &&
        process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID !== "common"
          ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0/`
          : undefined,
    }),

    // Auto-infers clientId from AUTH_APPLE_ID, clientSecret from AUTH_APPLE_SECRET.
    // Apple requires HTTPS — sign-in will not work on http://localhost.
    Apple,
  ],
});
