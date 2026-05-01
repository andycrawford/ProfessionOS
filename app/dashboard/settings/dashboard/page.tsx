"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  CloudSun,
  Mail,
  Calendar,
  MessageSquare,
  Zap,
  Trash2,
  Bot,
  Plus,
  Star,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DashboardWidget, DashboardWidgetType, Dashboard } from "@/lib/types";
import {
  getAllWidgetDefs,
  type BuiltinWidgetDef,
  type WidgetConfigField,
} from "@/components/widgets/registry";
import styles from "./dashboard.module.css";

// ── Icon lookup ──────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  Clock: <Clock size={16} />,
  CloudSun: <CloudSun size={16} />,
  Mail: <Mail size={16} />,
  Calendar: <Calendar size={16} />,
  MessageSquare: <MessageSquare size={16} />,
  Zap: <Zap size={16} />,
};

function iconFor(name: string): React.ReactNode {
  return ICONS[name] ?? null;
}

// ── Available-widget shape returned by the API ──────────────────────────────

interface AvailableWidget {
  widgetType: string;
  displayName: string;
  description: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultConfig: Record<string, unknown>;
  configFields: WidgetConfigField[];
  serviceId?: string;
  automationId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardSettingsPage() {
  // ── Dashboards state ───────────────────────────────────────────────────────
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashId, setActiveDashId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Available widgets from plugins/automations ─────────────────────────────
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>(
    [],
  );

  // ── AI creation state ──────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ── Expanded config panels ─────────────────────────────────────────────────
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  // ── Rename editing ─────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);

  // ── Built-in widget definitions ────────────────────────────────────────────
  const builtinDefs = getAllWidgetDefs();

  // ── Active dashboard ───────────────────────────────────────────────────────
  const activeDash =
    dashboards.find((d) => d.id === activeDashId) ??
    dashboards.find((d) => d.isDefault) ??
    dashboards[0];
  const widgets = activeDash?.widgets ?? [];

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/dashboards")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setDashboards(data);
          const def = data.find((d: Dashboard) => d.isDefault) ?? data[0];
          setActiveDashId(def.id);
        }
      })
      .catch(() => setError("Failed to load dashboards."))
      .finally(() => setLoading(false));

    fetch("/api/settings/available-widgets")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data)) setAvailableWidgets(data);
      })
      .catch(() => {});
  }, []);

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveDashboards = async (toSave?: Dashboard[]) => {
    const data = toSave ?? dashboards;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/dashboards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save.");
      } else {
        const saved: Dashboard[] = await res.json();
        setDashboards(saved);
        setSaved(true);
      }
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Dashboard CRUD ─────────────────────────────────────────────────────────

  const addDashboard = () => {
    const newDash: Dashboard = {
      id: crypto.randomUUID(),
      name: "New Dashboard",
      isDefault: false,
      widgets: [],
    };
    const next = [...dashboards, newDash];
    setDashboards(next);
    setActiveDashId(newDash.id);
    setEditingName(true);
    saveDashboards(next);
  };

  const deleteDashboard = (id: string) => {
    const dash = dashboards.find((d) => d.id === id);
    if (!dash || dash.isDefault) return; // cannot delete default
    const next = dashboards.filter((d) => d.id !== id);
    setDashboards(next);
    if (activeDashId === id) {
      const def = next.find((d) => d.isDefault) ?? next[0];
      setActiveDashId(def?.id ?? null);
    }
    saveDashboards(next);
  };

  const renameDashboard = (name: string) => {
    if (!activeDash) return;
    const next = dashboards.map((d) =>
      d.id === activeDash.id ? { ...d, name: name.trim() || d.name } : d,
    );
    setDashboards(next);
    setEditingName(false);
    setSaved(false);
  };

  const makeDefault = () => {
    if (!activeDash || activeDash.isDefault) return;
    const next = dashboards.map((d) => ({
      ...d,
      isDefault: d.id === activeDash.id,
    }));
    setDashboards(next);
    saveDashboards(next);
  };

  // ── Widget helpers (scoped to active dashboard) ────────────────────────────

  const updateWidgets = useCallback(
    (updater: (ws: DashboardWidget[]) => DashboardWidget[]) => {
      setDashboards((prev) =>
        prev.map((d) =>
          d.id === activeDashId ? { ...d, widgets: updater(d.widgets) } : d,
        ),
      );
      setSaved(false);
    },
    [activeDashId],
  );

  const findBuiltin = useCallback(
    (type: DashboardWidgetType) => widgets.find((w) => w.type === type),
    [widgets],
  );

  const toggleBuiltin = useCallback(
    (def: BuiltinWidgetDef) => {
      const existing = widgets.find((w) => w.type === def.type);
      if (existing) {
        updateWidgets((ws) => ws.filter((w) => w.type !== def.type));
      } else {
        const offset = widgets.length * 24;
        const w: DashboardWidget = {
          id: crypto.randomUUID(),
          title: def.displayName,
          content: "",
          type: def.type,
          x: 16 + offset,
          y: 16 + offset,
          width: def.defaultWidth,
          height: def.defaultHeight,
          collapsed: false,
          config: { ...def.defaultConfig },
        };
        updateWidgets((ws) => [...ws, w]);
      }
    },
    [widgets, updateWidgets],
  );

  const updateBuiltinConfig = useCallback(
    (type: DashboardWidgetType, key: string, value: string) => {
      updateWidgets((ws) =>
        ws.map((w) =>
          w.type === type
            ? { ...w, config: { ...(w.config ?? {}), [key]: value } }
            : w,
        ),
      );
    },
    [updateWidgets],
  );

  // ── Available (plugin/automation) widget helpers ───────────────────────────

  const availKey = (aw: AvailableWidget) =>
    aw.automationId ? `automation:${aw.automationId}` : aw.widgetType;

  const isAvailEnabled = useCallback(
    (aw: AvailableWidget) => {
      if (aw.automationId) {
        return widgets.some(
          (w) =>
            w.type === "automation" &&
            (w.config?.automationId as string) === aw.automationId,
        );
      }
      return widgets.some((w) => w.type === aw.widgetType);
    },
    [widgets],
  );

  const findAvailInstance = useCallback(
    (aw: AvailableWidget) => {
      if (aw.automationId) {
        return widgets.find(
          (w) =>
            w.type === "automation" &&
            (w.config?.automationId as string) === aw.automationId,
        );
      }
      return widgets.find((w) => w.type === aw.widgetType);
    },
    [widgets],
  );

  const toggleAvailable = useCallback(
    (aw: AvailableWidget) => {
      const existing = findAvailInstance(aw);
      if (existing) {
        updateWidgets((ws) => ws.filter((w) => w.id !== existing.id));
      } else {
        const offset = widgets.length * 24;
        const w: DashboardWidget = {
          id: crypto.randomUUID(),
          title: aw.displayName,
          content: "",
          type: aw.widgetType,
          x: 16 + offset,
          y: 16 + offset,
          width: aw.defaultWidth,
          height: aw.defaultHeight,
          collapsed: false,
          config: { ...aw.defaultConfig },
        };
        updateWidgets((ws) => [...ws, w]);
      }
    },
    [widgets, findAvailInstance, updateWidgets],
  );

  const updateAvailConfig = useCallback(
    (aw: AvailableWidget, key: string, value: string) => {
      const instance = findAvailInstance(aw);
      if (!instance) return;
      updateWidgets((ws) =>
        ws.map((w) =>
          w.id === instance.id
            ? { ...w, config: { ...(w.config ?? {}), [key]: value } }
            : w,
        ),
      );
    },
    [findAvailInstance, updateWidgets],
  );

  // ── Custom widget handlers ─────────────────────────────────────────────────

  const deleteWidget = useCallback(
    (id: string) => {
      updateWidgets((ws) => ws.filter((w) => w.id !== id));
    },
    [updateWidgets],
  );

  const addBlankWidget = () => {
    const w: DashboardWidget = {
      id: crypto.randomUUID(),
      title: "New Widget",
      content: "",
      type: "ai_custom",
      x: 16,
      y: 16,
      width: 280,
      height: 200,
      collapsed: false,
    };
    updateWidgets((ws) => [...ws, w]);
  };

  // ── AI-assisted widget creation ────────────────────────────────────────────
  const generateWidget = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Create a dashboard widget based on this request. Reply with ONLY a short title on the first line, then a blank line, then the widget content (plain text). Keep it concise.\n\nRequest: ${aiPrompt}`,
            },
          ],
        }),
      });

      if (!res.body) throw new Error("No response");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      const lines = text.trim().split("\n");
      const title = lines[0]?.replace(/^#+\s*/, "").trim() || "AI Widget";
      const content = lines.slice(1).join("\n").trim();

      const w: DashboardWidget = {
        id: crypto.randomUUID(),
        title,
        content,
        type: "ai_custom",
        x: 16 + widgets.length * 24,
        y: 16 + widgets.length * 24,
        width: 320,
        height: 240,
        collapsed: false,
      };
      updateWidgets((ws) => [...ws, w]);
      setAiPrompt("");
    } catch {
      setError("Failed to generate widget. Please try again.");
    } finally {
      setAiGenerating(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const customWidgets = widgets.filter((w) => w.type === "ai_custom");
  const pluginWidgets = availableWidgets.filter((aw) =>
    aw.widgetType.startsWith("plugin:"),
  );
  const automationWidgets = availableWidgets.filter(
    (aw) => aw.widgetType === "automation",
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageLayout}>
      {/* ── Card-file dashboard selector (left) ── */}
      <aside className={styles.dashSelector}>
        <p className={styles.dashSelectorLabel}>Dashboards</p>
        <ul className={styles.dashList}>
          {dashboards.map((d) => (
            <li key={d.id}>
              <button
                className={`${styles.dashCard} ${d.id === activeDash?.id ? styles.dashCardActive : ""}`}
                onClick={() => {
                  setActiveDashId(d.id);
                  setEditingName(false);
                }}
              >
                <span className={styles.dashCardName}>
                  {d.name}
                  {d.isDefault && (
                    <Star
                      size={10}
                      className={styles.dashDefaultIcon}
                      aria-label="Default"
                    />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className={styles.dashAddBtn} onClick={addDashboard}>
          <Plus size={14} /> New
        </button>
      </aside>

      {/* ── Dashboard settings (right) ── */}
      <div className={styles.page}>
        {loading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : !activeDash ? (
          <div className={styles.empty}>No dashboards found.</div>
        ) : (
          <>
            {/* Dashboard name + rename */}
            <div className={styles.header}>
              {editingName ? (
                <input
                  className={styles.renameInput}
                  autoFocus
                  defaultValue={activeDash.name}
                  onBlur={(e) => renameDashboard(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      renameDashboard((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
              ) : (
                <h1 className={styles.heading}>
                  {activeDash.name}
                  <button
                    className={styles.renameBtn}
                    onClick={() => setEditingName(true)}
                    aria-label="Rename dashboard"
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                </h1>
              )}
              <p className={styles.subheading}>
                Configure widgets for this dashboard.
                {activeDash.isDefault && " This is the default dashboard."}
              </p>
            </div>

            {/* ── Section 1: Built-in Widgets ── */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Built-in Widgets</h2>
              <p className={styles.sectionDesc}>
                Toggle widgets on or off for this dashboard.
              </p>

              <ul className={styles.list} aria-label="Built-in widget toggles">
                {builtinDefs.map((def) => {
                  const instance = findBuiltin(def.type);
                  const enabled = !!instance;
                  const configOpen = expandedConfig === def.type;

                  return (
                    <li key={def.type} className={styles.builtinItem}>
                      <div
                        className={`${styles.item} ${!enabled ? styles.itemDisabled : ""}`}
                      >
                        <span className={styles.itemIcon} aria-hidden="true">
                          {iconFor(def.icon)}
                        </span>
                        <div className={styles.itemBody}>
                          <span className={styles.itemLabel}>
                            {def.displayName}
                          </span>
                          <span className={styles.itemDesc}>
                            {def.description}
                          </span>
                        </div>
                        <div className={styles.itemActions}>
                          {enabled && def.configFields.length > 0 && (
                            <button
                              className={styles.configToggle}
                              onClick={() =>
                                setExpandedConfig(
                                  configOpen ? null : def.type,
                                )
                              }
                              aria-label={`${configOpen ? "Hide" : "Show"} ${def.displayName} settings`}
                              title="Widget settings"
                            >
                              {configOpen ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>
                          )}
                          <button
                            className={`${styles.toggleBtn} ${enabled ? styles.toggleOn : styles.toggleOff}`}
                            onClick={() => toggleBuiltin(def)}
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${enabled ? "Disable" : "Enable"} ${def.displayName}`}
                          >
                            <span className={styles.toggleKnob} />
                          </button>
                        </div>
                      </div>

                      {enabled && configOpen && instance && (
                        <div className={styles.configPanel}>
                          {def.configFields.map((field) => (
                            <ConfigFieldInput
                              key={field.key}
                              field={field}
                              value={
                                (instance.config?.[field.key] as string) ?? ""
                              }
                              onChange={(v) =>
                                updateBuiltinConfig(def.type, field.key, v)
                              }
                            />
                          ))}
                          <div className={styles.configSaveRow}>
                            <button
                              className={styles.saveBtn}
                              onClick={() => saveDashboards()}
                              disabled={saving}
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ── Section 2: Service Plugin Widgets ── */}
            {pluginWidgets.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Service Widgets</h2>
                <p className={styles.sectionDesc}>
                  Widgets detected from your connected services.
                </p>
                <ul className={styles.list} aria-label="Service plugin widgets">
                  {pluginWidgets.map((aw) => {
                    const key = availKey(aw);
                    const enabled = isAvailEnabled(aw);
                    const instance = findAvailInstance(aw);
                    const configOpen = expandedConfig === key;

                    return (
                      <li key={key} className={styles.builtinItem}>
                        <div
                          className={`${styles.item} ${!enabled ? styles.itemDisabled : ""}`}
                        >
                          <span className={styles.itemIcon} aria-hidden="true">
                            {iconFor(aw.icon)}
                          </span>
                          <div className={styles.itemBody}>
                            <span className={styles.itemLabel}>
                              {aw.displayName}
                            </span>
                            <span className={styles.itemDesc}>
                              {aw.description}
                            </span>
                          </div>
                          <div className={styles.itemActions}>
                            {enabled && aw.configFields.length > 0 && (
                              <button
                                className={styles.configToggle}
                                onClick={() =>
                                  setExpandedConfig(
                                    configOpen ? null : key,
                                  )
                                }
                                title="Widget settings"
                              >
                                {configOpen ? (
                                  <ChevronUp size={14} />
                                ) : (
                                  <ChevronDown size={14} />
                                )}
                              </button>
                            )}
                            <button
                              className={`${styles.toggleBtn} ${enabled ? styles.toggleOn : styles.toggleOff}`}
                              onClick={() => toggleAvailable(aw)}
                              role="switch"
                              aria-checked={enabled}
                            >
                              <span className={styles.toggleKnob} />
                            </button>
                          </div>
                        </div>

                        {enabled && configOpen && instance && (
                          <div className={styles.configPanel}>
                            {aw.configFields.map((field) => (
                              <ConfigFieldInput
                                key={field.key}
                                field={field}
                                value={
                                  (instance.config?.[field.key] as string) ?? ""
                                }
                                onChange={(v) =>
                                  updateAvailConfig(aw, field.key, v)
                                }
                              />
                            ))}
                            <div className={styles.configSaveRow}>
                              <button
                                className={styles.saveBtn}
                                onClick={() => saveDashboards()}
                                disabled={saving}
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ── Section 3: Automation Widgets ── */}
            {automationWidgets.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Automation Widgets</h2>
                <p className={styles.sectionDesc}>
                  Each automation can be displayed as a dashboard tile with a Run
                  button.
                </p>
                <ul className={styles.list} aria-label="Automation widgets">
                  {automationWidgets.map((aw) => {
                    const key = availKey(aw);
                    const enabled = isAvailEnabled(aw);
                    return (
                      <li key={key}>
                        <div
                          className={`${styles.item} ${!enabled ? styles.itemDisabled : ""}`}
                        >
                          <span className={styles.itemIcon} aria-hidden="true">
                            {iconFor(aw.icon)}
                          </span>
                          <div className={styles.itemBody}>
                            <span className={styles.itemLabel}>
                              {aw.displayName}
                            </span>
                            <span className={styles.itemDesc}>
                              {aw.description}
                            </span>
                          </div>
                          <div className={styles.itemActions}>
                            <button
                              className={`${styles.toggleBtn} ${enabled ? styles.toggleOn : styles.toggleOff}`}
                              onClick={() => toggleAvailable(aw)}
                              role="switch"
                              aria-checked={enabled}
                            >
                              <span className={styles.toggleKnob} />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ── Section 4: Custom Widgets ── */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Custom Widgets</h2>
                <button className={styles.newBtn} onClick={addBlankWidget}>
                  + New Widget
                </button>
              </div>
              <p className={styles.sectionDesc}>
                Free-form tiles. Drag to move, resize from the corner.
              </p>

              <div className={styles.promptRow}>
                <Bot
                  size={16}
                  style={{
                    flexShrink: 0,
                    marginTop: 10,
                    color: "var(--color-accent-brand)",
                  }}
                />
                <input
                  className={styles.promptInput}
                  type="text"
                  placeholder="Describe a widget for AI to create…"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !aiGenerating) generateWidget();
                  }}
                />
                <button
                  className={styles.promptSubmit}
                  onClick={generateWidget}
                  disabled={aiGenerating || !aiPrompt.trim()}
                >
                  {aiGenerating ? "Generating…" : "Create with AI"}
                </button>
              </div>

              {customWidgets.length === 0 ? (
                <div className={styles.empty}>
                  No custom widgets yet. Add one above.
                </div>
              ) : (
                <ul className={styles.list} aria-label="Custom widgets">
                  {customWidgets.map((w) => (
                    <li key={w.id} className={styles.item}>
                      <div className={styles.itemBody}>
                        <span className={styles.itemLabel}>{w.title}</span>
                        <span className={styles.itemDesc}>
                          {w.content
                            ? w.content.slice(0, 80) +
                              (w.content.length > 80 ? "…" : "")
                            : "Empty widget"}
                        </span>
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => deleteWidget(w.id)}
                          aria-label={`Delete ${w.title}`}
                          title="Delete widget"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {error && <p className={styles.errorMsg}>{error}</p>}
            {saved && <p className={styles.successMsg}>Saved.</p>}

            {/* ── Footer buttons ── */}
            <div className={styles.saveRow}>
              <button
                className={styles.saveBtn}
                onClick={() => saveDashboards()}
                disabled={saving || loading}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {!activeDash.isDefault && (
                <button
                  className={styles.makeDefaultBtn}
                  onClick={makeDefault}
                  disabled={saving}
                >
                  <Star size={12} /> Make Default
                </button>
              )}
              {!activeDash.isDefault && (
                <button
                  className={styles.deleteBtn}
                  onClick={() => deleteDashboard(activeDash.id)}
                  aria-label="Delete this dashboard"
                  title="Delete dashboard"
                  style={{ marginLeft: "auto" }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Config field renderer ────────────────────────────────────────────────────

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: WidgetConfigField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <label className={styles.configField}>
        <span className={styles.configLabel}>{field.label}</span>
        <select
          className={styles.configSelect}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={styles.configField}>
      <span className={styles.configLabel}>{field.label}</span>
      <input
        className={styles.configInput}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </label>
  );
}
