"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, AlertCircle, Loader2, Puzzle } from "lucide-react";
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
  /** True when the plugin uses OAuth — shows "Authorize" button instead of "Connect" */
  hasOAuth?: boolean;
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
  // Seed error from query param — set by the OAuth callback on failure
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  function handleSelect(plugin: PluginMeta) {
    setSelected(plugin);
    // Seed defaults: empty strings for text fields, false for checkboxes
    const defaults: Record<string, string | number | boolean> = {};
    for (const f of plugin.configFields) {
      if (f.type === "checkbox") defaults[f.key] = false;
      else if (f.type === "number") defaults[f.key] = 0;
      else if ((f.type === "select" || f.type === "dynamic-select") && f.options?.[0]) defaults[f.key] = f.options[0].value;
      else defaults[f.key] = "";
    }
    setValues(defaults);
    setError(null);
  }

  function handleOAuth() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);

    // For OAuth plugins, redirect to the authorize route which will kick off
    // the consent flow and eventually create the service record on callback.
    const params = new URLSearchParams({
      accountId: String(values.accountId ?? ""),
      displayName: selected.displayName,
    });
    // Navigate — the server route handles the redirect chain from here.
    window.location.href = `/api/auth/netsuite/authorize?${params}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    // OAuth plugins use a different flow: redirect to the authorize route.
    if (selected.hasOAuth) {
      handleOAuth();
      return;
    }

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
          </div>

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
                  {selected.hasOAuth ? "Redirecting…" : "Connecting…"}
                </>
              ) : (
                selected.hasOAuth ? "Authorize with NetSuite" : "Connect"
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
