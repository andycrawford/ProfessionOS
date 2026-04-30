"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Play, FlaskConical, ToggleLeft, ToggleRight, Trash2, Pencil } from "lucide-react";
import styles from "./automations.module.css";

export interface AutomationRow {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  enabled: boolean;
  writeMode: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  pluginServiceId: string;
  pluginServiceName: string;
  createdAt: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: string | null): string {
  if (!status) return "";
  if (status.includes("success")) return styles.statusSuccess;
  if (status.includes("error")) return styles.statusError;
  return styles.statusNeutral;
}

export default function AutomationsClient({
  automations: initial,
}: {
  automations: AutomationRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AutomationRow[]>(initial);
  const [running, setRunning] = useState<Record<string, "run" | "dry_run">>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleToggle(id: string, current: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !current } : r)));
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: current } : r)));
      setErrors((prev) => ({ ...prev, [id]: "Failed to toggle" }));
    }
  }

  async function handleRun(id: string, dryRun: boolean) {
    const key = dryRun ? "dry_run" : "run";
    setRunning((prev) => ({ ...prev, [id]: key }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const res = await fetch(`/api/automations/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      const status = dryRun ? "dry_run_success" : "success";
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, lastRunAt: new Date().toISOString(), lastRunStatus: status }
            : r
        )
      );
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setRunning((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete automation "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      } else {
        setErrors((prev) => ({ ...prev, [id]: "Failed to delete" }));
      }
    } catch {
      setErrors((prev) => ({ ...prev, [id]: "Network error" }));
    }
  }

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <Zap size={32} className={styles.emptyIcon} aria-hidden="true" />
        <p className={styles.emptyTitle}>No automations yet</p>
        <p className={styles.emptyBody}>
          Open the Code Automation plugin and use the AI Assistant to create your first automation.
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.list} role="list">
      {rows.map((row) => {
        const isRunning = running[row.id];
        const error = errors[row.id];

        return (
          <li key={row.id} className={styles.card}>
            {error && <p className={styles.rowError}>{error}</p>}
            <div className={styles.cardRow}>
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{row.name}</span>
                  <span className={styles.badge}>{row.triggerType}</span>
                  {/* Read-only/read-write toggle — greyed out in Phase 1 */}
                  <span
                    className={`${styles.badge} ${styles.badgeDisabled}`}
                    title="Read-write mode will be available in a future update"
                  >
                    {row.writeMode === "read_write" ? "read-write" : "read-only"}
                  </span>
                </div>
                {row.description && (
                  <p className={styles.description}>{row.description}</p>
                )}
                <p className={styles.meta}>
                  {row.pluginServiceName} · Last run:{" "}
                  <span className={statusColor(row.lastRunStatus)}>
                    {row.lastRunStatus ? `${formatDate(row.lastRunAt)} (${row.lastRunStatus})` : "Never"}
                  </span>
                </p>
              </div>

              <div className={styles.actions}>
                {/* Enable/disable toggle */}
                <button
                  className={styles.iconButton}
                  onClick={() => handleToggle(row.id, row.enabled)}
                  title={row.enabled ? "Disable automation" : "Enable automation"}
                  aria-label={row.enabled ? "Disable" : "Enable"}
                >
                  {row.enabled ? (
                    <ToggleRight size={18} className={styles.toggleOn} />
                  ) : (
                    <ToggleLeft size={18} className={styles.toggleOff} />
                  )}
                </button>

                {/* Edit/Continue — navigates to Code dashboard with this automation open */}
                <Link
                  href={`/dashboard/code?editId=${row.id}`}
                  className={styles.actionButton}
                  title="Edit automation with AI chat"
                >
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </Link>

                {/* Dry run */}
                <button
                  className={styles.actionButton}
                  onClick={() => handleRun(row.id, true)}
                  disabled={!!isRunning}
                  title="Dry run — simulates without making changes"
                >
                  <FlaskConical size={14} aria-hidden="true" />
                  {isRunning === "dry_run" ? "Running…" : "Dry Run"}
                </button>

                {/* Run */}
                <button
                  className={`${styles.actionButton} ${styles.primary}`}
                  onClick={() => handleRun(row.id, false)}
                  disabled={!!isRunning}
                  title="Run automation now"
                >
                  <Play size={14} aria-hidden="true" />
                  {isRunning === "run" ? "Running…" : "Run"}
                </button>

                {/* Delete */}
                <button
                  className={`${styles.actionButton} ${styles.destructive}`}
                  onClick={() => handleDelete(row.id, row.name)}
                  disabled={!!isRunning}
                  aria-label={`Delete ${row.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
