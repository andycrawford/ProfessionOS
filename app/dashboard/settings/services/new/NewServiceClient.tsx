"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, AlertCircle, Loader2, Puzzle, Info } from "lucide-react";
import ServiceIcon from "@/components/ServiceIcon";
import ServiceConfigForm from "@/components/ServiceConfigForm";
import styles from "./new-service.module.css";
import type { ConfigField, ServiceType } from "@/services/types";

interface PluginMeta {
  type: ServiceType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  configFields: ConfigField[];
  /** True when the plugin uses a static OAuth flow (e.g. NetSuite). */
  hasOAuth?: boolean;
  /**
   * Config field key whose value "oauth" triggers a dynamic OAuth redirect
   * instead of the direct-connect API (e.g. MS365 plugins).
   */
  oauthSourceField?: string;
  /** Server-side authorize endpoint to redirect to when oauthSourceField === "oauth". */
  oauthAuthorizeEndpoint?: string;
}

interface Props {
  plugins: PluginMeta[];
}

export default function NewServiceClient({ plugins }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<PluginMeta | null>(null);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  // Seed from query params — set by OAuth callbacks on error/info
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [info, setInfo] = useState<string | null>(searchParams.get("info"));

  function handleSelect(plugin: PluginMeta) {
    setSelected(plugin);
    const defaults: Record<string, string | number | boolean> = {};
    for (const f of plugin.configFields) {
      if (f.type === "checkbox") defaults[f.key] = false;
      else if (f.type === "number") defaults[f.key] = 0;
      else if ((f.type === "select" || f.type === "dynamic-select") && f.options?.[0]) defaults[f.key] = f.options[0].value;
      else defaults[f.key] = "";
    }
    setValues(defaults);
    setError(null);
    setInfo(null);
  }

  /** True when the current config requires an OAuth redirect (dynamic OAuth plugins). */
  function isOAuthRedirect(): boolean {
    if (!selected?.oauthSourceField || !selected.oauthAuthorizeEndpoint) return false;
    return String(values[selected.oauthSourceField] ?? "") === "oauth";
  }

  function handleNetSuiteOAuth() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const params = new URLSearchParams({
      accountId: String(values.accountId ?? ""),
      displayName: selected.displayName,
    });
    window.location.href = `/api/auth/netsuite/authorize?${params}`;
  }

  function handleDynamicOAuth() {
    if (!selected?.oauthAuthorizeEndpoint || !selected.oauthSourceField) return;
    const orgId = String(values.ssoOrgId ?? "");
    if (!orgId) {
      setError("Please select an Organisation before signing in with Microsoft.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const params = new URLSearchParams({
      orgId,
      serviceType: selected.type,
      config: JSON.stringify(values),
    });
    window.location.href = `${selected.oauthAuthorizeEndpoint}?${params}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    if (selected.hasOAuth) { handleNetSuiteOAuth(); return; }
    if (isOAuthRedirect()) { handleDynamicOAuth(); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selected.type,
          displayName: selected.displayName,
          config: values,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Server error: ${res.status}`
        );
      }

      const { id } = (await res.json()) as { id: string };
      router.push(`/dashboard/settings/services/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  /** Admin consent URL for the current org — grants org-wide delegated permission. */
  function adminConsentHref(): string | null {
    if (!selected?.oauthAuthorizeEndpoint || !selected.oauthSourceField) return null;
    if (String(values[selected.oauthSourceField] ?? "") !== "oauth") return null;
    const orgId = String(values.ssoOrgId ?? "");
    if (!orgId) return null;
    const params = new URLSearchParams({
      orgId,
      serviceType: selected.type,
      config: JSON.stringify(values),
      adminConsent: "true",
    });
    return `${selected.oauthAuthorizeEndpoint}?${params}`;
  }

  const adminHref = adminConsentHref();

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/dashboard/settings/services" className={styles.breadcrumbLink}>
          Services
        </Link>
        <ChevronRight size={12} className={styles.breadcrumbSep} aria-hidden="true" />
        <span>Add Service</span>
      </nav>

      <h1 className={styles.heading}>Choose a service</h1>
      <p className={styles.subheading}>
        Select the service you want to connect. You&apos;ll configure credentials on the next step.
      </p>

      {/* Plugin picker */}
      {plugins.length === 0 ? (
        <div className={styles.emptyPlugins}>
          <Puzzle size={28} style={{ margin: "0 auto var(--space-3)", display: "block", color: "var(--color-text-disabled)" }} aria-hidden="true" />
          No plugins are registered yet. Plugin implementations will be available after the next release.
        </div>
      ) : (
        <div className={styles.grid} role="list" aria-label="Available plugins">
          {plugins.map((plugin) => (
            <button
              key={plugin.type}
              role="listitem"
              className={`${styles.pluginCard}${selected?.type === plugin.type ? ` ${styles.selected}` : ""}`}
              onClick={() => handleSelect(plugin)}
              aria-pressed={selected?.type === plugin.type}
            >
              <div
                className={styles.pluginIcon}
                style={{ color: plugin.color }}
              >
                <ServiceIcon name={plugin.icon} size={20} />
              </div>
              <div>
                <div className={styles.pluginName}>{plugin.displayName}</div>
                <div className={styles.pluginDesc}>{plugin.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Config form — shown after a plugin is selected */}
      {selected && (
        <form onSubmit={handleSubmit}>
          <div className={styles.configCard}>
            <div className={styles.configHeader}>
              <div
                className={styles.configIconWrap}
                style={{ color: selected.color }}
              >
                <ServiceIcon name={selected.icon} size={20} />
              </div>
              <span className={styles.configTitle}>{selected.displayName}</span>
            </div>

            {selected.configFields.length === 0 ? (
              <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--color-text-secondary)" }}>
                No configuration required — click Connect to add this service.
              </p>
            ) : (
              <>
                <p className={styles.sectionTitle}>Configuration</p>
                <ServiceConfigForm
                  fields={selected.configFields}
                  values={values}
                  onChange={(key, val) =>
                    setValues((prev) => ({ ...prev, [key]: val }))
                  }
                  disabled={submitting}
                />
              </>
            )}

            {/* Admin consent helper — shown when OAuth mode and an org is selected */}
            {adminHref && (
              <p style={{
                fontSize: "var(--text-body-sm-size)",
                color: "var(--color-text-secondary)",
                marginTop: "var(--space-3)",
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "flex-start",
              }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <span>
                  To let everyone in your organisation connect without a consent dialog,{" "}
                  <a
                    href={adminHref}
                    style={{ color: "var(--color-text-accent)", textDecoration: "underline" }}
                  >
                    grant admin consent for your organisation
                  </a>{" "}
                  (requires Global Admin). This is optional — you can still sign in individually below.
                </span>
              </p>
            )}
          </div>

          {info && (
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-default)",
                background: "color-mix(in srgb, var(--color-success-muted) 20%, transparent)",
                color: "var(--color-success)",
                fontSize: "var(--text-body-sm-size)",
                marginBottom: "var(--space-3)",
              }}
              role="status"
            >
              <Info size={14} aria-hidden="true" />
              {info}
            </div>
          )}

          {error && (
            <div className={styles.errorBanner} role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.connectButton}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2
                    size={14}
                    className={styles.spinner}
                    aria-hidden="true"
                    style={{ display: "inline-block", marginRight: "var(--space-2)", verticalAlign: "middle" }}
                  />
                  Redirecting…
                </>
              ) : isOAuthRedirect() ? (
                "Sign in with Microsoft"
              ) : selected.hasOAuth ? (
                "Authorize with NetSuite"
              ) : (
                "Connect"
              )}
            </button>
            <Link
              href="/dashboard/settings/services"
              className={styles.cancelButton}
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
