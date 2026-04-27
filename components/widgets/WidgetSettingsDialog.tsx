"use client";

import { useState } from "react";
import { X, ChevronUp, ChevronDown, Mail, Calendar, MessageSquare, Code2, Users, Database } from "lucide-react";
import type { WidgetPreference } from "@/lib/types";
import { netsuiteKeyLabel } from "@/lib/metrics";
import styles from "./WidgetSettingsDialog.module.css";

const STATIC_LABELS: Record<string, string> = {
  mail:      "Email",
  calendar:  "Calendar",
  messaging: "Messaging",
  code:      "Code",
  crm:       "CRM",
};

function getServiceLabel(key: string, label?: string): string {
  if (label) return label;
  return STATIC_LABELS[key] ?? netsuiteKeyLabel(key);
}

function getServiceIcon(key: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    mail:      <Mail size={16} />,
    calendar:  <Calendar size={16} />,
    messaging: <MessageSquare size={16} />,
    code:      <Code2 size={16} />,
    crm:       <Users size={16} />,
  };
  if (key in icons) return icons[key];
  if (key.startsWith("netsuite_")) return <Database size={16} />;
  return null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Current saved preferences — dialog initializes local state from this on open */
  prefs: WidgetPreference[];
  onSave: (prefs: WidgetPreference[]) => Promise<void>;
}

export default function WidgetSettingsDialog({ open, onClose, prefs, onSave }: Props) {
  // Local draft — initialized from props on each mount (dialog unmounts when closed)
  const [local, setLocal] = useState<WidgetPreference[]>(prefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const move = (index: number, dir: -1 | 1) => {
    const next = [...local];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLocal(next);
  };

  const toggle = (index: number) => {
    const next = [...local];
    next[index] = { ...next[index], enabled: !next[index].enabled };
    setLocal(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(local);
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      onKeyDown={handleBackdropKeyDown}
      role="presentation"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="metrics-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="metrics-dialog-title" className={styles.title}>
            Metrics Tiles
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className={styles.description}>
          Choose which metrics appear on your dashboard and set their display order.
        </p>

        <ul className={styles.list} aria-label="Metric tile configuration">
          {local.map((pref, index) => (
            <li
              key={pref.key}
              className={`${styles.item} ${!pref.enabled ? styles.itemDisabled : ""}`}
            >
              <span className={styles.itemIcon} aria-hidden="true">
                {getServiceIcon(pref.key)}
              </span>
              <span className={styles.itemLabel}>{getServiceLabel(pref.key, pref.label)}</span>

              <div className={styles.itemActions}>
                <button
                  className={styles.reorderBtn}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${getServiceLabel(pref.key, pref.label)} up`}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className={styles.reorderBtn}
                  onClick={() => move(index, 1)}
                  disabled={index === local.length - 1}
                  aria-label={`Move ${getServiceLabel(pref.key, pref.label)} down`}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>

                <button
                  className={`${styles.toggleBtn} ${pref.enabled ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => toggle(index)}
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

        {error && <p className={styles.errorMsg}>{error}</p>}

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
