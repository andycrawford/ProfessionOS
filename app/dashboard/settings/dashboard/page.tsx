"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  Calendar,
  MessageSquare,
  Code2,
  Users,
  Database,
  Trash2,
  Bot,
} from "lucide-react";
import type { WidgetPreference, DashboardWidget } from "@/lib/types";
import { DEFAULT_WIDGET_PREFS } from "@/lib/types";
import { netsuiteKeyLabel } from "@/lib/metrics";
import styles from "./dashboard.module.css";

// ── Activity Tile helpers ─────────────────────────────────────────────────────

const STATIC_LABELS: Record<string, string> = {
  mail: "Email",
  calendar: "Calendar",
  messaging: "Messaging",
  code: "Code",
  crm: "CRM",
};

function getServiceLabel(key: string, label?: string): string {
  if (label) return label;
  return STATIC_LABELS[key] ?? netsuiteKeyLabel(key);
}

function getServiceIcon(key: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    mail: <Mail size={16} />,
    calendar: <Calendar size={16} />,
    messaging: <MessageSquare size={16} />,
    code: <Code2 size={16} />,
    crm: <Users size={16} />,
  };
  if (key in icons) return icons[key];
  if (key.startsWith("netsuite_")) return <Database size={16} />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardSettingsPage() {
  // ── Activity Tiles state ────────────────────────────────────────────────────
  const [tilePrefs, setTilePrefs] = useState<WidgetPreference[]>(
    DEFAULT_WIDGET_PREFS,
  );
  const [tileLoading, setTileLoading] = useState(true);
  const [tileSaving, setTileSaving] = useState(false);
  const [tileSaved, setTileSaved] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);

  // ── Dashboard Widgets state ─────────────────────────────────────────────────
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [widgetSaving, setWidgetSaving] = useState(false);
  const [widgetSaved, setWidgetSaved] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // ── AI creation state ───────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/widgets")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data)) setTilePrefs(data);
      })
      .catch(() => setTileError("Failed to load activity tiles."))
      .finally(() => setTileLoading(false));

    fetch("/api/settings/dashboard-widgets")
      .then(async (r) => {
        const data = await r.json();
        if (Array.isArray(data)) setWidgets(data);
      })
      .catch(() => setWidgetError("Failed to load dashboard widgets."))
      .finally(() => setWidgetLoading(false));
  }, []);

  // ── Activity Tiles handlers ─────────────────────────────────────────────────
  const toggleTile = useCallback((index: number) => {
    setTilePrefs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
    setTileSaved(false);
  }, []);

  const saveTilePrefs = async () => {
    setTileSaving(true);
    setTileError(null);
    setTileSaved(false);
    try {
      const res = await fetch("/api/settings/widgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tilePrefs),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTileError(data.error ?? "Failed to save.");
      } else {
        const saved = await res.json();
        if (Array.isArray(saved)) setTilePrefs(saved);
        setTileSaved(true);
      }
    } catch {
      setTileError("Failed to save.");
    } finally {
      setTileSaving(false);
    }
  };

  // ── Dashboard Widget handlers ───────────────────────────────────────────────
  const deleteWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setWidgetSaved(false);
  }, []);

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

  // ── AI-assisted widget creation ─────────────────────────────────────────────
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

      // Parse: first line = title, rest = content
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Dashboard</h1>
        <p className={styles.subheading}>
          Configure dashboard tiles, widgets, and activity tile visibility.
        </p>
      </div>

      {/* ── Section 1: Activity Tiles ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Activity Tiles</h2>
        <p className={styles.sectionDesc}>
          Toggle the metric tiles shown in your dashboard header row.
        </p>

        {tileLoading ? (
          <div className={styles.loadingMsg}>Loading…</div>
        ) : (
          <ul className={styles.list} aria-label="Activity tile toggles">
            {tilePrefs.map((pref, index) => (
              <li
                key={pref.key}
                className={`${styles.item} ${!pref.enabled ? styles.itemDisabled : ""}`}
              >
                <span className={styles.itemIcon} aria-hidden="true">
                  {getServiceIcon(pref.key)}
                </span>
                <div className={styles.itemBody}>
                  <span className={styles.itemLabel}>
                    {getServiceLabel(pref.key, pref.label)}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <button
                    className={`${styles.toggleBtn} ${pref.enabled ? styles.toggleOn : styles.toggleOff}`}
                    onClick={() => toggleTile(index)}
                    role="switch"
                    aria-checked={pref.enabled}
                    aria-label={`${pref.enabled ? "Hide" : "Show"} ${getServiceLabel(pref.key, pref.label)}`}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tileError && <p className={styles.errorMsg}>{tileError}</p>}
        {tileSaved && <p className={styles.successMsg}>Tile preferences saved.</p>}

        <div className={styles.saveRow}>
          <button
            className={styles.saveBtn}
            onClick={saveTilePrefs}
            disabled={tileSaving || tileLoading}
          >
            {tileSaving ? "Saving…" : "Save tile preferences"}
          </button>
        </div>
      </section>

      {/* ── Section 2: Dashboard Widgets ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Dashboard Widgets</h2>
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
          <Bot size={16} style={{ flexShrink: 0, marginTop: 10, color: "var(--color-accent-brand)" }} />
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
        ) : widgets.length === 0 ? (
          <div className={styles.empty}>
            No dashboard widgets yet. Add one above.
          </div>
        ) : (
          <ul className={styles.list} aria-label="Dashboard widgets">
            {widgets.map((w) => (
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
