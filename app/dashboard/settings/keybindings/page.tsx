"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { DEFAULT_KEYBINDINGS } from "@/lib/types";
import type { KeybindingDef, KeybindingOverrides } from "@/lib/types";
import { formatShortcutKeys } from "@/lib/formatKey";
import styles from "./keybindings.module.css";

interface PluginBinding {
  action: string;
  defaultKey: string;
  description: string;
  pluginName: string;
  pluginType: string;
}

/** Converts a KeyboardEvent into the shortcut format used by useKeyboardShortcuts */
function eventToShortcut(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  // Ignore modifier-only keypresses
  if (["control", "meta", "alt", "shift"].includes(key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("cmd");
  if (e.shiftKey && key !== "?") parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(key);
  return parts.join("+");
}

function KeyBadges({ shortcut }: { shortcut: string }) {
  const badges = formatShortcutKeys(shortcut);
  return (
    <span className={styles.keysRow}>
      {badges.map((badge, i) => (
        <kbd key={i} className={styles.key}>
          {badge}
        </kbd>
      ))}
    </span>
  );
}

export default function KeybindingsPage() {
  const [overrides, setOverrides] = useState<KeybindingOverrides>({});
  const [pluginBindings, setPluginBindings] = useState<PluginBinding[]>([]);
  const [recording, setRecording] = useState<string | null>(null); // action id being recorded
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<string | null>(null);

  // Keep ref in sync for the event listener
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    fetch("/api/settings/keybindings")
      .then((r) => r.json())
      .then((data) => {
        setOverrides(data.overrides ?? {});
        setPluginBindings(data.pluginBindings ?? []);
      })
      .catch(() => {});
  }, []);

  // Global keydown listener when recording
  const handleRecordKey = useCallback((e: KeyboardEvent) => {
    if (!recordingRef.current) return;
    if (e.key === "Escape") {
      setRecording(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const shortcut = eventToShortcut(e);
    if (!shortcut) return;

    const actionId = recordingRef.current;
    setOverrides((prev) => ({ ...prev, [actionId]: shortcut }));
    setRecording(null);
  }, []);

  useEffect(() => {
    if (recording) {
      window.addEventListener("keydown", handleRecordKey, { capture: true });
    } else {
      window.removeEventListener("keydown", handleRecordKey, { capture: true });
    }
    return () => window.removeEventListener("keydown", handleRecordKey, { capture: true });
  }, [recording, handleRecordKey]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/keybindings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrides),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetAction(actionId: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[actionId];
      return next;
    });
  }

  // Combine built-ins and plugin bindings into a unified table
  const builtinCategories = Array.from(new Set(DEFAULT_KEYBINDINGS.map((d) => d.category)));

  function renderRow(def: KeybindingDef | null, action: string, defaultKey: string, label: string) {
    const isRecording = recording === action;
    const currentKey = overrides[action] ?? defaultKey;
    const isOverridden = !!overrides[action];

    return (
      <li key={action} className={styles.row}>
        <span className={styles.actionLabel}>{label}</span>
        <div className={styles.rowControls}>
          {isRecording ? (
            <button
              className={`${styles.recordBtn} ${styles.recording}`}
              onClick={() => setRecording(null)}
              aria-label="Cancel recording"
            >
              Press any key… (Esc to cancel)
            </button>
          ) : (
            <button
              className={styles.recordBtn}
              onClick={() => setRecording(action)}
              aria-label={`Change shortcut for ${label}`}
            >
              <KeyBadges shortcut={currentKey} />
            </button>
          )}
          {isOverridden && !isRecording && (
            <button
              className={styles.resetBtn}
              onClick={() => resetAction(action)}
              aria-label={`Reset ${label} to default`}
              title="Reset to default"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Keybindings</h1>
        <p className={styles.subheading}>
          Customize keyboard shortcuts. Click a binding to record a new key.
        </p>
      </div>

      {builtinCategories.map((cat) => (
        <section key={cat} className={styles.section}>
          <h2 className={styles.sectionTitle}>{cat}</h2>
          <ul className={styles.list}>
            {DEFAULT_KEYBINDINGS.filter((d) => d.category === cat).map((def) =>
              renderRow(def, def.id, def.defaultKey, def.action)
            )}
          </ul>
        </section>
      ))}

      {pluginBindings.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Plugins</h2>
          <ul className={styles.list}>
            {pluginBindings.map((pb) =>
              renderRow(null, pb.action, pb.defaultKey, `${pb.description} (${pb.pluginName})`)
            )}
          </ul>
        </section>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.saveRow}>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
