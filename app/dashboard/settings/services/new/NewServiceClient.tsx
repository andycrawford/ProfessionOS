"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, AlertCircle, Loader2, Puzzle } from "lucide-react";
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
}

interface Props {
  plugins: PluginMeta[];
}

export default function NewServiceClient({ plugins }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<PluginMeta | null>(null);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(plugin: PluginMeta) {
    setSelected(plugin);
    // Seed defaults: empty strings for text fields, false for checkboxes
    const defaults: Record<string, string | number | boolean> = {};
    for (const f of plugin.configFields) {
      defaults[f.key] = f.type === "checkbox" ? false : f.type === "number" ? 0 : "";
    }
    setValues(defaults);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selected.type, config: values }),
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
                aria-hidden="true"
              >
                {plugin.icon}
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
                aria-hidden="true"
              >
                {selected.icon}
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
                  Connecting…
                </>
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
