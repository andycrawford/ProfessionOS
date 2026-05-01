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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DashboardWidget, DashboardWidgetType } from "@/lib/types";
import {
  getAllWidgetDefs,
  type BuiltinWidgetDef,
  type WidgetConfigField,
} from "@/components/widgets/registry";
import styles from "./dashboard.module.css";

// ── Icon lookup (keeps imports static, avoids dynamic require) ──────────────

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
  // ── Dashboard Widgets state (persisted array) ──────────────────────────────
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [widgetSaving, setWidgetSaving] = useState(false);
  const [widgetSaved, setWidgetSaved] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // ── Available widgets from plugins/automations ─────────────────────────────
  const [availableWidgets, setAvailableWidgets] = useState<AvailableWidget[]>(
    [],
  );

  // ── AI creation state ──────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ── Expanded config panels ─────────────────────────────────────────────────
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  // ── Built-in widget definitions ────────────────────────────────────────────
  const builtinDefs = getAllWidgetDefs();

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/dashboard-widgets")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data)) setWidgets(data);
      })
      .catch(() => setWidgetError("Failed to load dashboard widgets."))
      .finally(() => setWidgetLoading(false));

    fetch("/api/settings/available-widgets")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data)) setAvailableWidgets(data);
      })
      .catch(() => {});
  }, []);

  // ── Save helpers ───────────────────────────────────────────────────────────
  const saveWidgets = async (widgetsToSave?: DashboardWidget[]) => {
    const data = widgetsToSave ?? widgets;
    setWidgetSaving(true);
    setWidgetError(null);
    setWidgetSaved(false);
    try {
      const res = await fetch("/api/settings/dashboard-widgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setWidgetError(d.error ?? "Failed to save.");
      } else {
        const saved: DashboardWidget[] = await res.json();
        setWidgets(saved);
        setWidgetSaved(true);
      }
    } catch {
      setWidgetError("Failed to save.");
    } finally {
      setWidgetSaving(false);
    }
  };

  // ── Built-in widget helpers ────────────────────────────────────────────────

  const findBuiltin = useCallback(
    (type: DashboardWidgetType) => widgets.find((w) => w.type === type),
    [widgets],
  );

  const toggleBuiltin = useCallback(
    (def: BuiltinWidgetDef) => {
      const existing = widgets.find((w) => w.type === def.type);
      let next: DashboardWidget[];
      if (existing) {
        next = widgets.filter((w) => w.type !== def.type);
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
        next = [...widgets, w];
      }
      setWidgets(next);
      saveWidgets(next);
    },
    [widgets],
  );

  const updateBuiltinConfig = useCallback(
    (type: DashboardWidgetType, key: string, value: string) => {
      setWidgets((prev) =>
        prev.map((w) =>
          w.type === type
            ? { ...w, config: { ...(w.config ?? {}), [key]: value } }
            : w,
        ),
      );
      setWidgetSaved(false);
    },
    [],
  );

  // ── Available (plugin/automation) widget helpers ───────────────────────────

  /** Unique key for an available widget (type + optional automationId). */
  const availKey = (aw: AvailableWidget) =>
    aw.automationId ? `automation:${aw.automationId}` : aw.widgetType;

  /** Check if an available widget is currently enabled (in the widgets array). */
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
      let next: DashboardWidget[];
      if (existing) {
        next = widgets.filter((w) => w.id !== existing.id);
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
        next = [...widgets, w];
      }
      setWidgets(next);
      saveWidgets(next);
    },
    [widgets, findAvailInstance],
  );

  const updateAvailConfig = useCallback(
    (aw: AvailableWidget, key: string, value: string) => {
      const instance = findAvailInstance(aw);
      if (!instance) return;
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === instance.id
            ? { ...w, config: { ...(w.config ?? {}), [key]: value } }
            : w,
        ),
      );
      setWidgetSaved(false);
    },
    [findAvailInstance],
  );

  // ── Custom widget handlers ─────────────────────────────────────────────────

  const deleteWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setWidgetSaved(false);
  }, []);

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
    const next = [...widgets, w];
    setWidgets(next);
    saveWidgets(next);
  };

  // ── AI-assisted widget creation ────────────────────────────────────────────
  const generateWidget = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setWidgetError(null);

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
      const next = [...widgets, w];
      setWidgets(next);
      setAiPrompt("");
      saveWidgets(next);
    } catch {
      setWidgetError("Failed to generate widget. Please try again.");
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
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Dashboard</h1>
        <p className={styles.subheading}>
          Enable built-in widgets, service widgets, and automation tiles.
        </p>
      </div>

      {/* ── Section 1: Built-in Widgets ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Built-in Widgets</h2>
        <p className={styles.sectionDesc}>
          Toggle widgets on or off. Enabled widgets appear as tiles in the
          dashboard center area.
        </p>

        {widgetLoading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : (
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
                            setExpandedConfig(configOpen ? null : def.type)
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
                          onClick={() => saveWidgets()}
                          disabled={widgetSaving}
                        >
                          {widgetSaving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Section 2: Service Plugin Widgets ── */}
      {pluginWidgets.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Service Widgets</h2>
          <p className={styles.sectionDesc}>
            Widgets detected from your connected services. Toggle to display in
            the dashboard.
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
                            setExpandedConfig(configOpen ? null : key)
                          }
                          aria-label={`${configOpen ? "Hide" : "Show"} ${aw.displayName} settings`}
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
                        aria-label={`${enabled ? "Disable" : "Enable"} ${aw.displayName}`}
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
                          onChange={(v) => updateAvailConfig(aw, field.key, v)}
                        />
                      ))}
                      <div className={styles.configSaveRow}>
                        <button
                          className={styles.saveBtn}
                          onClick={() => saveWidgets()}
                          disabled={widgetSaving}
                        >
                          {widgetSaving ? "Saving…" : "Save"}
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
            button. Toggle to enable.
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
                        aria-label={`${enabled ? "Disable" : "Enable"} ${aw.displayName}`}
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
          Free-form tiles displayed in the dashboard center area. Drag to move,
          resize from the corner, and collapse or close as needed.
        </p>

        {/* AI widget creation */}
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

        {widgetLoading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : customWidgets.length === 0 ? (
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

        {widgetError && <p className={styles.errorMsg}>{widgetError}</p>}
        {widgetSaved && <p className={styles.successMsg}>Widgets saved.</p>}

        <div className={styles.saveRow}>
          <button
            className={styles.saveBtn}
            onClick={() => saveWidgets()}
            disabled={widgetSaving || widgetLoading}
          >
            {widgetSaving ? "Saving…" : "Save widgets"}
          </button>
        </div>
      </section>
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
