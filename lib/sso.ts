import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { decrypt } from "@/lib/encrypt";

export interface OrgSsoConfig {
  orgId: string;
  name: string;
  domain: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Look up SSO configuration for an email address by extracting and matching its domain.
 * Returns null if no SSO-enabled org matches the domain.
 */
export async function lookupOrgByEmailDomain(
  email: string
): Promise<OrgSsoConfig | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return lookupOrgByDomain(domain);
}

/**
 * Look up SSO configuration for a specific domain string.
 * Returns null if no org with ssoEnabled=true and full credentials matches.
 */
export async function lookupOrgByDomain(
  domain: string
): Promise<OrgSsoConfig | null> {
  const db = getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.domain, domain.toLowerCase()))
    .limit(1);

  if (!org?.ssoEnabled) return null;
  if (!org.entraIdTenantId || !org.ssoClientId || !org.ssoClientSecret) {
    return null;
  }

  return {
    orgId: org.id,
    name: org.name,
    domain: org.domain,
    tenantId: org.entraIdTenantId,
    clientId: org.ssoClientId,
    clientSecret: decryptSecret(org.ssoClientSecret),
  };
}

/**
 * Load all SSO-enabled orgs from DB with their decrypted credentials.
 * Used by auth.ts to register per-org NextAuth providers at startup.
 */
export async function loadAllSsoOrgs(): Promise<OrgSsoConfig[]> {
  const db = getDb();
  const orgs = await db
    .select()
    .from(organizations)
    .where(eq(organizations.ssoEnabled, true));

  return orgs
    .filter((o) => o.entraIdTenantId && o.ssoClientId && o.ssoClientSecret)
    .map((o) => ({
      orgId: o.id,
      name: o.name,
      domain: o.domain,
      tenantId: o.entraIdTenantId!,
      clientId: o.ssoClientId!,
      clientSecret: decryptSecret(o.ssoClientSecret!),
    }));
}

/**
 * Decrypt a stored SSO secret.
 * Falls back to returning the raw value if decryption fails — this allows
 * secrets entered as plain text during development to still work.
 */
function decryptSecret(stored: string): string {
  try {
    return decrypt(stored);
  } catch {
    return stored;
  }
}
