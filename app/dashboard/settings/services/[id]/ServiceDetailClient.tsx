"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wifi,
} from "lucide-react";
import ServiceConfigForm from "@/components/ServiceConfigForm";
import styles from "./service-detail.module.css";
import type { ConfigField, ServiceStatus, ServiceType } from "@/services/types";

export interface ServiceDetailProps {
  id: string;
  type: ServiceType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  status: ServiceStatus;
  configFields: ConfigField[];
  config: Record<string, string | number | boolean>;
}

type TestResult = "success" | "failure" | null;

export default function ServiceDetailClient({
  id,
  type,
  displayName,
  description,
  icon,
  color,
  configFields,
  config: initialConfig,
}: ServiceDetailProps) {
  const router = useRouter();

  const [formValues, setFormValues] = useState<
    Record<string, string | number | boolean>
  >(initialConfig);
  const [isDirty, setIsDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  function handleFieldChange(key: string, value: string | number | boolean) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setTestResult(null);
    setSaveError(null);
    setSaveSuccess(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formValues }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Server error: ${res.status}`
        );
      }
      setIsDirty(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (isDirty) {
      // Prompt to save first — the test endpoint uses stored config
      setSaveError(
        "Save your changes before testing the connection."
      );
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/services/${id}/test`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({ ok: false }));
      setTestResult((body as { ok: boolean }).ok ? "success" : "failure");
    } catch {
      setTestResult("failure");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        `Disconnect ${displayName}? This will remove all synced data.`
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      router.push("/dashboard/settings/services");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
      setDisconnecting(false);
    }
  }

  const busy = saving || testing || disconnecting;

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link
          href="/dashboard/settings/services"
          className={styles.breadcrumbLink}
        >
          Services
        </Link>
        <ChevronRight
          size={12}
          className={styles.breadcrumbSep}
          aria-hidden="true"
        />
        <span>{displayName}</span>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <div
          className={styles.iconWrap}
          style={{ color }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div>
          <h1 className={styles.heading}>{displayName}</h1>
          <p className={styles.subheading}>{description}</p>
        </div>
      </div>

      {/* Config form */}
      <form onSubmit={handleSave}>
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Configuration</p>
          {configFields.length === 0 ? (
            <p
              style={{
                fontSize: "var(--text-body-sm-size)",
                color: "var(--color-text-secondary)",
              }}
            >
              This service has no configurable fields.
            </p>
          ) : (
            <ServiceConfigForm
              fields={configFields}
              values={formValues}
              onChange={handleFieldChange}
              disabled={busy}
            />
          )}
        </div>

        {/* Link behavior — not relevant for embed_website (no activity items) */}
        {type !== "embed_website" && (
          <div className={styles.card}>
            <p className={styles.sectionTitle}>Link behavior</p>
            <p
              style={{
                fontSize: "var(--text-body-sm-size)",
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-4)",
              }}
            >
              Choose how links from this service open when you click them.
            </p>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
                fontSize: "var(--text-body-sm-size)",
                color: "var(--color-text-primary)",
              }}
            >
              Open links in
              <select
                value={(formValues.linkBehavior as string | undefined) ?? "new_tab"}
                onChange={(e) => handleFieldChange("linkBehavior", e.target.value)}
                disabled={busy}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--color-bg-raised)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "var(--radius-default)",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--text-body-base-size)",
                  cursor: busy ? "not-allowed" : "default",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <option value="new_tab">New tab</option>
                <option value="embed">Embed in dashboard</option>
              </select>
            </label>
          </div>
        )}

        {saveError && (
          <div
            className={`${styles.testResult} ${styles.failure}`}
            role="alert"
          >
            <AlertCircle size={14} aria-hidden="true" />
            {saveError}
          </div>
        )}

        {saveSuccess && !saveError && (
          <div
            className={`${styles.testResult} ${styles.success}`}
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            Changes saved
          </div>
        )}

        {testResult && (
          <div
            className={`${styles.testResult} ${
              testResult === "success" ? styles.success : styles.failure
            }`}
            role="status"
            aria-live="polite"
          >
            {testResult === "success" ? (
              <>
                <CheckCircle2 size={14} aria-hidden="true" />
                Connection successful
              </>
            ) : (
              <>
                <AlertCircle size={14} aria-hidden="true" />
                Connection failed — check your credentials
              </>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={busy || !isDirty}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            className={styles.testButton}
            onClick={handleTest}
            disabled={busy}
            aria-label="Test connection with saved config"
          >
            {testing ? (
              <Loader2
                size={14}
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : (
              <Wifi size={14} aria-hidden="true" />
            )}
            {testing ? "Testing…" : "Test connection"}
          </button>

          <button
            type="button"
            className={styles.disconnectButton}
            onClick={handleDisconnect}
            disabled={busy}
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </form>
    </div>
  );
}
