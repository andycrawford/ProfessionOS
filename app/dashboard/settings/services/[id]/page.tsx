"use client";

import { useState, useEffect, use } from "react";
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
import type { ConfigField, ServiceStatus } from "@/services/types";

interface ServiceDetail {
  id: string;
  type: string;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  status: ServiceStatus;
  lastSyncedAt: string | null;
  itemCount: number;
  configFields: ConfigField[];
  config: Record<string, string | number | boolean>;
}

type TestResult = "success" | "failure" | null;

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const [disconnecting, setDisconnecting] = useState(false);

  // Load service details
  useEffect(() => {
    fetch(`/api/services/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json() as Promise<ServiceDetail>;
      })
      .then((svc) => {
        setService(svc);
        setFormValues(svc.config);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleFieldChange(key: string, value: string | number | boolean) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setSaveError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formValues }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error: ${res.status}`);
      }
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/services/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: formValues }),
      });
      setTestResult(res.ok ? "success" : "failure");
    } catch {
      setTestResult("failure");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    if (
      !window.confirm(
        `Disconnect ${service?.displayName}? This will remove all synced data.`
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      router.push("/dashboard/settings/services");
    } catch (err) {
      alert((err as Error).message);
      setDisconnecting(false);
    }
  }

  const busy = saving || testing || disconnecting;

  if (loading) {
    return (
      <div className={styles.stateMessage} role="status" aria-live="polite">
        <Loader2 size={16} className={styles.spinner} aria-hidden="true" />
        Loading service…
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className={`${styles.stateMessage} ${styles.error}`} role="alert">
        <AlertCircle size={16} aria-hidden="true" />
        {error ?? "Service not found"}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/dashboard/settings/services" className={styles.breadcrumbLink}>
          Services
        </Link>
        <ChevronRight size={12} className={styles.breadcrumbSep} aria-hidden="true" />
        <span>{service.displayName}</span>
      </nav>

      {/* Header */}
      <div className={styles.header}>
        <div
          className={styles.iconWrap}
          style={{ color: service.color }}
          aria-hidden="true"
        >
          {service.icon}
        </div>
        <div>
          <h1 className={styles.heading}>{service.displayName}</h1>
          <p className={styles.subheading}>{service.description}</p>
        </div>
      </div>

      {/* Config form */}
      <form onSubmit={handleSave}>
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Configuration</p>
          {service.configFields.length === 0 ? (
            <p style={{ fontSize: "var(--text-body-sm-size)", color: "var(--color-text-secondary)" }}>
              This service has no configurable fields.
            </p>
          ) : (
            <ServiceConfigForm
              fields={service.configFields}
              values={formValues}
              onChange={handleFieldChange}
              disabled={busy}
            />
          )}
        </div>

        {saveError && (
          <div className={`${styles.testResult} ${styles.failure}`} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {saveError}
          </div>
        )}

        {testResult && (
          <div
            className={`${styles.testResult} ${testResult === "success" ? styles.success : styles.failure}`}
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
          <button type="submit" className={styles.saveButton} disabled={busy}>
            {saving ? "Saving…" : "Save changes"}
          </button>

          <button
            type="button"
            className={styles.testButton}
            onClick={handleTest}
            disabled={busy}
            aria-label="Test connection with current config"
          >
            {testing ? (
              <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
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
