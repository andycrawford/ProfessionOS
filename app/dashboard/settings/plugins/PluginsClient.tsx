"use client";

import { useState } from "react";
import { Puzzle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import styles from "./plugins.module.css";

export interface PluginRow {
  id: string;
  type: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PluginsClient({
  plugins: initial,
}: {
  plugins: PluginRow[];
}) {
  const [plugins, setPlugins] = useState<PluginRow[]>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [codeCache, setCodeCache] = useState<Record<string, string>>({});
  const [codeLoading, setCodeLoading] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({});
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});

  async function handleToggle(id: string, current: boolean) {
    setToggling(id);
    setToggleErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    // Optimistic update
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !current } : p))
    );
    try {
      const res = await fetch(`/api/plugins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      if (!res.ok) {
        // Revert optimistic update
        setPlugins((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enabled: current } : p))
        );
        setToggleErrors((prev) => ({ ...prev, [id]: "Failed to update plugin" }));
      }
    } catch {
      // Revert optimistic update
      setPlugins((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: current } : p))
      );
      setToggleErrors((prev) => ({ ...prev, [id]: "Network error" }));
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete plugin "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setDeleteErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const res = await fetch(`/api/plugins/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPlugins((prev) => prev.filter((p) => p.id !== id));
        if (expandedId === id) setExpandedId(null);
      } else {
        setDeleteErrors((prev) => ({ ...prev, [id]: "Failed to delete plugin" }));
      }
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [id]: "Network error" }));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!codeCache[id]) {
      setCodeLoading(id);
      setCodeErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
      try {
        const res = await fetch(`/api/plugins/${id}`);
        if (res.ok) {
          const data = await res.json();
          setCodeCache((prev) => ({ ...prev, [id]: data.code ?? "" }));
        } else {
          setCodeErrors((prev) => ({ ...prev, [id]: "Failed to load plugin code" }));
        }
      } catch {
        setCodeErrors((prev) => ({ ...prev, [id]: "Network error" }));
      } finally {
        setCodeLoading(null);
      }
    }
  }

  if (plugins.length === 0) {
    return (
      <div className={styles.empty}>
        <Puzzle size={32} className={styles.emptyIcon} aria-hidden="true" />
        <p className={styles.emptyTitle}>No custom plugins yet</p>
        <p className={styles.emptyBody}>
          Use the AI panel to generate a custom plugin for any service.
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.list} role="list">
      {plugins.map((plugin) => {
        const isExpanded = expandedId === plugin.id;
        const isDeleting = deletingId === plugin.id;
        const isToggling = toggling === plugin.id;
        const toggleError = toggleErrors[plugin.id];
        const deleteError = deleteErrors[plugin.id];
        const codeError = codeErrors[plugin.id];

        return (
          <li key={plugin.id} className={styles.card}>
            {(toggleError || deleteError) && (
              <p className={styles.rowError}>{toggleError ?? deleteError}</p>
            )}
            <div className={styles.cardRow}>
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{plugin.name}</span>
                  <span className={styles.typeBadge}>{plugin.type}</span>
                </div>
                {plugin.description && (
                  <p className={styles.description}>{plugin.description}</p>
                )}
                <p className={styles.meta}>Created {formatDate(plugin.createdAt)}</p>
              </div>

              <div className={styles.actions}>
                {/* Enable/disable toggle */}
                <label
                  className={styles.toggleLabel}
                  title={plugin.enabled ? "Disable plugin" : "Enable plugin"}
                >
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={plugin.enabled}
                    disabled={isToggling}
                    onChange={() => handleToggle(plugin.id, plugin.enabled)}
                    aria-label={`${plugin.enabled ? "Disable" : "Enable"} ${plugin.name}`}
                  />
                  <span className={styles.toggle} />
                </label>

                {/* View / hide code */}
                <button
                  className={styles.actionButton}
                  onClick={() => handleExpand(plugin.id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Hide code" : "View code"}
                >
                  {isExpanded ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                  {isExpanded ? "Hide" : "Code"}
                </button>

                {/* Delete */}
                <button
                  className={`${styles.actionButton} ${styles.destructive}`}
                  onClick={() => handleDelete(plugin.id, plugin.name)}
                  disabled={isDeleting}
                  aria-label={`Delete ${plugin.name}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.codeBlock}>
                {codeLoading === plugin.id ? (
                  <p className={styles.codeLoading}>Loading…</p>
                ) : codeError ? (
                  <p className={styles.codeError}>{codeError}</p>
                ) : (
                  <pre className={styles.pre}>
                    <code>{codeCache[plugin.id] ?? ""}</code>
                  </pre>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
