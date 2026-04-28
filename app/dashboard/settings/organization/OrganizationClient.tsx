"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { ExternalLink, Shield, Building2 } from "lucide-react";
import styles from "./organization.module.css";

export type OrgData = {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  entraIdTenantId: string | null;
  ssoClientId: string | null;
  ssoClientSecretSet: boolean;
  ssoEnabled: boolean;
  createdAt: Date;
  userRole: "admin" | "member";
};

type Props = { org: OrgData | null };

export default function OrganizationClient({ org: initialOrg }: Props) {
  const [org, setOrg] = useState<OrgData | null>(initialOrg);
  const [creating, setCreating] = useState(false);

  // Create-org form state
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Edit-org form state (profile section)
  const [profileName, setProfileName] = useState(initialOrg?.name ?? "");
  const [profileDomain, setProfileDomain] = useState(initialOrg?.domain ?? "");
  const [profileLogoUrl, setProfileLogoUrl] = useState(initialOrg?.logoUrl ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // SSO form state
  const [ssoEnabled, setSsoEnabled] = useState(initialOrg?.ssoEnabled ?? false);
  const [tenantId, setTenantId] = useState(initialOrg?.entraIdTenantId ?? "");
  const [clientId, setClientId] = useState(initialOrg?.ssoClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [ssoSaving, setSsoSaving] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoSuccess, setSsoSuccess] = useState(false);

  const isAdmin = org?.userRole === "admin";

  // ── Create org ──────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, domain: newDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create organization");
        return;
      }
      setOrg(data);
      setProfileName(data.name);
      setProfileDomain(data.domain);
      setSsoEnabled(data.ssoEnabled);
      setCreating(false);
    } catch {
      setCreateError("Network error");
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Save profile ────────────────────────────────────────────────────────────

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, domain: profileDomain, logoUrl: profileLogoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? "Failed to save");
        return;
      }
      setOrg((prev) => prev ? { ...prev, name: data.name, domain: data.domain, logoUrl: data.logoUrl } : prev);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError("Network error");
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Save SSO ────────────────────────────────────────────────────────────────

  async function handleSaveSSO(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSsoError(null);
    setSsoSuccess(false);
    setSsoSaving(true);
    try {
      const body: Record<string, unknown> = {
        ssoEnabled,
        entraIdTenantId: tenantId,
        ssoClientId: clientId,
      };
      // Only send the secret if the user typed a new value
      if (clientSecret) body.ssoClientSecret = clientSecret;

      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSsoError(data.error ?? "Failed to save SSO config");
        return;
      }
      setOrg((prev) =>
        prev
          ? {
              ...prev,
              ssoEnabled: data.ssoEnabled,
              entraIdTenantId: data.entraIdTenantId,
              ssoClientId: data.ssoClientId,
              ssoClientSecretSet: data.ssoClientSecretSet,
            }
          : prev
      );
      setClientSecret(""); // clear the secret field after save
      setSsoSuccess(true);
      setTimeout(() => setSsoSuccess(false), 3000);
    } catch {
      setSsoError("Network error");
    } finally {
      setSsoSaving(false);
    }
  }

  // ── No org yet ──────────────────────────────────────────────────────────────

  if (!org && !creating) {
    return (
      <div className={styles.empty}>
        <Building2 size={40} className={styles.emptyIcon} aria-hidden="true" />
        <p className={styles.emptyTitle}>No organization yet</p>
        <p className={styles.emptyBody}>
          Create an organization to manage members and configure enterprise SSO.
        </p>
        <button className={styles.primaryButton} onClick={() => setCreating(true)}>
          Create Organization
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <form onSubmit={handleCreate} className={styles.section}>
        <h2 className={styles.sectionTitle}>Create Organization</h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-name">Organization name</label>
          <input
            id="new-name"
            className={styles.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Acme Corp"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-domain">Email domain</label>
          <input
            id="new-domain"
            className={styles.input}
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="acme.com"
            required
          />
          <p className={styles.hint}>Used to match employees by email address.</p>
        </div>
        {createError && <p className={styles.error}>{createError}</p>}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setCreating(false)}
          >
            Cancel
          </button>
          <button type="submit" className={styles.primaryButton} disabled={createLoading}>
            {createLoading ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    );
  }

  // ── Org exists ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.sections}>
      {/* Profile section — admin only for editing */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <form onSubmit={handleSaveProfile}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="org-name">Organization name</label>
            <input
              id="org-name"
              className={styles.input}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={!isAdmin}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="org-domain">Email domain</label>
            <input
              id="org-domain"
              className={styles.input}
              value={profileDomain}
              onChange={(e) => setProfileDomain(e.target.value)}
              disabled={!isAdmin}
              required
            />
            <p className={styles.hint}>Used to match employees by email address.</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="org-logo-url">Logo URL</label>
            <input
              id="org-logo-url"
              className={styles.input}
              type="url"
              value={profileLogoUrl}
              onChange={(e) => setProfileLogoUrl(e.target.value)}
              disabled={!isAdmin}
              placeholder="https://example.com/logo.png"
            />
            <p className={styles.hint}>Displayed in the header alongside your organization name. Leave blank to use the default logo.</p>
          </div>
          {profileError && <p className={styles.error}>{profileError}</p>}
          {profileSuccess && <p className={styles.success}>Saved.</p>}
          {isAdmin && (
            <button type="submit" className={styles.primaryButton} disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save"}
            </button>
          )}
        </form>
      </section>

      {/* SSO section — only rendered for admins */}
      {isAdmin && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Shield size={18} aria-hidden="true" />
            <h2 className={styles.sectionTitle}>Single Sign-On (Entra ID)</h2>
          </div>
          <p className={styles.sectionDesc}>
            Configure Azure Active Directory / Entra ID to let employees sign in with their
            work accounts.
          </p>

          <form onSubmit={handleSaveSSO}>
            {/* Enable toggle */}
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel} htmlFor="sso-enabled">
                Enable SSO
              </label>
              <input
                id="sso-enabled"
                type="checkbox"
                className={styles.toggle}
                checked={ssoEnabled}
                onChange={(e) => setSsoEnabled(e.target.checked)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tenant-id">
                Entra ID Tenant ID
              </label>
              <input
                id="tenant-id"
                className={styles.input}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="client-id">
                Application (Client) ID
              </label>
              <input
                id="client-id"
                className={styles.input}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="client-secret">
                Client Secret
              </label>
              <input
                id="client-secret"
                className={styles.input}
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={org.ssoClientSecretSet ? "••••••••  (set — leave blank to keep)" : "Enter client secret"}
                autoComplete="new-password"
              />
            </div>

            {ssoError && <p className={styles.error}>{ssoError}</p>}
            {ssoSuccess && <p className={styles.success}>SSO configuration saved.</p>}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={ssoSaving}>
                {ssoSaving ? "Saving…" : "Save SSO Config"}
              </button>
              <button
                type="button"
                className={`${styles.testLink}${(!org.entraIdTenantId || !org.ssoClientId || !org.ssoClientSecretSet) ? ` ${styles.testLinkDisabled}` : ""}`}
                disabled={!org.entraIdTenantId || !org.ssoClientId || !org.ssoClientSecretSet}
                title={(!org.entraIdTenantId || !org.ssoClientId || !org.ssoClientSecretSet) ? "Save complete SSO config first" : undefined}
                onClick={() => signIn(`microsoft-entra-id-${org.id}`, { callbackUrl: "/dashboard/settings/organization" })}
              >
                Test SSO Login
                <ExternalLink size={13} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
