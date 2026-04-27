"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Mail, Calendar, MessageSquare, Code2, Users } from "lucide-react";
import type { WidgetPreference, WidgetServiceKey } from "@/lib/types";
import { DEFAULT_WIDGET_PREFS } from "@/lib/types";
import styles from "./metrics.module.css";

const SERVICE_LABELS: Record<WidgetServiceKey, string> = {
  mail: "Email",
  calendar: "Calendar",
  messaging: "Messaging",
  code: "Code",
  crm: "CRM",
};

const SERVICE_DESCRIPTIONS: Record<WidgetServiceKey, string> = {
  mail: "Unread messages and inbox activity",
  calendar: "Upcoming events and meeting count",
  messaging: "Team messages and chat notifications",
  code: "Open pull requests and code review tasks",
  crm: "Follow-ups due and deal pipeline activity",
};

const SERVICE_ICONS: Record<WidgetServiceKey, React.ReactNode> = {
  mail: <Mail size={16} />,
  calendar: <Calendar size={16} />,
  messaging: <MessageSquare size={16} />,
  code: <Code2 size={16} />,
  crm: <Users size={16} />,
};

export default function MetricsSettingsPage() {
  const [prefs, setPrefs] = useState<WidgetPreference[]>(DEFAULT_WIDGET_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/widgets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrefs(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const move = useCallback((index: number, dir: -1 | 1) => {
    setPrefs((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }, []);

  const toggle = useCallback((index: number) => {
    setPrefs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], enabled: !next[index].enabled };
      return next;
    });
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/widgets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save. Please try again.");
      } else {
        const saved = await res.json();
        if (Array.isArray(saved)) setPrefs(saved);
        setSaved(true);
      }
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Metrics</h1>
        <p className={styles.subheading}>
          Choose which metrics appear in your dashboard header and set their display order.
        </p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Dashboard Tiles</h2>
        <p className={styles.sectionDesc}>
          Toggle tiles on or off and use the arrows to reorder them. Disabled tiles are hidden
          from the dashboard but retain their position for when you re-enable them.
        </p>

        {loading ? (
          <div className={styles.loadingMsg}>Loading preferences…</div>
        ) : (
          <ul className={styles.list} aria-label="Metric tile configuration">
            {prefs.map((pref, index) => (
              <li
                key={pref.key}
                className={`${styles.item} ${!pref.enabled ? styles.itemDisabled : ""}`}
              >
                <span className={styles.itemIcon} aria-hidden="true">
                  {SERVICE_ICONS[pref.key]}
                </span>
                <div className={styles.itemBody}>
                  <span className={styles.itemLabel}>{SERVICE_LABELS[pref.key]}</span>
                  <span className={styles.itemDesc}>{SERVICE_DESCRIPTIONS[pref.key]}</span>
                </div>

                <div className={styles.itemActions}>
                  <button
                    className={styles.reorderBtn}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${SERVICE_LABELS[pref.key]} up`}
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    className={styles.reorderBtn}
                    onClick={() => move(index, 1)}
                    disabled={index === prefs.length - 1}
                    aria-label={`Move ${SERVICE_LABELS[pref.key]} down`}
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>

                  <button
                    className={`${styles.toggleBtn} ${pref.enabled ? styles.toggleOn : styles.toggleOff}`}
                    onClick={() => toggle(index)}
                    role="switch"
                    aria-checked={pref.enabled}
                    aria-label={`${pref.enabled ? "Hide" : "Show"} ${SERVICE_LABELS[pref.key]}`}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && <p className={styles.errorMsg}>{error}</p>}
        {saved && <p className={styles.successMsg}>Preferences saved.</p>}

        <div className={styles.saveRow}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </section>
    </div>
  );
}
