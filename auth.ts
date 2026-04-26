import NextAuth from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { Provider } from "@auth/core/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, accounts, sessions, verificationTokens, organizationMembers } from "@/db/schema";
import { loadAllSsoOrgs, lookupOrgByEmailDomain } from "@/lib/sso";

/**
 * NextAuth v5 configuration for Profession OS.
 *
 * Session strategy: database (sessions stored in Postgres via DrizzleAdapter,
 * not JWTs). This enables server-side invalidation at the cost of one DB
 * lookup per authenticated request.
 *
 * Providers:
 *   - Google OAuth
 *   - Microsoft Entra ID — shared "common" tenant for personal + org accounts
 *   - Per-org Entra ID providers — one per SSO-enabled org row in DB
 *     Each org registers its own Azure App and stores its clientId/secret/tenantId.
 *     Provider id: `microsoft-entra-id-{orgId}` (URL-safe)
 *     Azure redirect URI: {AUTH_URL}/api/auth/callback/microsoft-entra-id-{orgId}
 *   - Apple Sign In
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
  // NextAuth's assertConfig uses `m in adapter` (not `adapter[m]`) to detect
  // missing methods, so a `has` trap is required in addition to `get`.
  get(_target, prop: string) {
    return Reflect.get(lazyAdapter(), prop);
  },
  has(_target, prop: string) {
    return prop in lazyAdapter();
  },
});

// ── Per-org provider cache ────────────────────────────────────────────────────
// Org SSO config rarely changes, so we cache the built providers for 5 minutes
// to avoid a DB hit on every auth request. A process restart or TTL expiry
// picks up newly added orgs automatically.

let _orgProviders: Provider[] = [];
let _orgProvidersLoadedAt = 0;
const ORG_PROVIDERS_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getOrgProviders(): Promise<Provider[]> {
  const now = Date.now();
  if (now - _orgProvidersLoadedAt < ORG_PROVIDERS_TTL_MS) {
    return _orgProviders;
  }

  let orgs;
  try {
    orgs = await loadAllSsoOrgs();
  } catch {
    // DB may be unavailable at build time or before migrations run — return
    // the stale cache (or empty list on first call) rather than crashing.
    return _orgProviders;
  }

  _orgProviders = orgs.map((org) =>
    MicrosoftEntraID({
      // Unique provider id — becomes the callback path segment:
      //   /api/auth/callback/microsoft-entra-id-{orgId}
      // Each org's Azure App Registration must list this as a redirect URI.
      id: `microsoft-entra-id-${org.orgId}`,
      name: `${org.name} (SSO)`,
      clientId: org.clientId,
      clientSecret: org.clientSecret,
      issuer: `https://login.microsoftonline.com/${org.tenantId}/v2.0`,
      // Auth.js calls p.account(tokenSet) for all new sign-ins. MicrosoftEntraID
      // does not define this method, causing TypeError: e is not a function in the
      // minified callback bundle. Returning the tokenSet passes the raw tokens
      // through for storage in the accounts table.
      account: (tokens) => tokens,
    })
  );
  _orgProvidersLoadedAt = now;
  return _orgProviders;
}

// ── Org membership upsert ─────────────────────────────────────────────────────

async function upsertOrgMember(userId: string, orgId: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, orgId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(organizationMembers).values({
      userId,
      organizationId: orgId,
      role: "member",
    });
  }
}

// ── NextAuth export ───────────────────────────────────────────────────────────

// When DATABASE_URL is absent (e.g. demo deployments), fall back to JWT
// sessions so NextAuth never calls the DB adapter on unauthenticated requests.
// All authenticated features remain behind auth guards that already require
// session.user.id to be present.
const hasDatabase = !!process.env.DATABASE_URL;

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  const orgProviders = await getOrgProviders();

  return {
    adapter: hasDatabase ? adapter : undefined,
    session: {
      strategy: hasDatabase ? "database" : "jwt",
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
            ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`
            : undefined,
        // Auth.js calls p.account(tokenSet) for all new sign-ins. MicrosoftEntraID
        // does not define this method, causing TypeError: e is not a function in the
        // minified callback bundle. Returning the tokenSet passes the raw tokens
        // through for storage in the accounts table.
        account: (tokens) => tokens,
      }),

      // Per-org enterprise providers — one per SSO-enabled org in DB
      ...orgProviders,

      // Auto-infers clientId from AUTH_APPLE_ID, clientSecret from AUTH_APPLE_SECRET.
      // Apple requires HTTPS — sign-in will not work on http://localhost.
      Apple,
    ],

    events: {
      /**
       * After any successful sign-in, check whether the user's email domain
       * matches an SSO-enabled org and create the organizationMembers row if
       * one doesn't already exist.
       *
       * This covers both the shared "microsoft-entra-id" provider (where a
       * user from an org domain signs in without SSO) and org-specific
       * providers. Non-Microsoft sign-ins with an org domain are also captured,
       * which is intentional — an org admin may later enforce SSO-only.
       */
      async signIn({ user }: { user: AdapterUser | { id?: string; email?: string | null } }) {
        if (!user?.id || !user?.email) return;

        const org = await lookupOrgByEmailDomain(user.email);
        if (!org) return;

        await upsertOrgMember(user.id, org.orgId);
      },
    },
  };
});

// ── safeAuth ──────────────────────────────────────────────────────────────────
// Wraps auth() with error handling so that deployments without DATABASE_URL
// (e.g. demo.professionos.com) return null instead of a 500 when NextAuth
// cannot reach the DB adapter. All existing auth-gated routes already treat a
// null session as unauthenticated — this just prevents the crash.
export async function safeAuth(): Promise<{ user?: { id?: string; email?: string | null; name?: string | null } } | null> {
  try {
    return await auth() as { user?: { id?: string; email?: string | null; name?: string | null } } | null;
  } catch {
    return null;
  }
}
