"use client";

import { X } from "lucide-react";
import { DEFAULT_KEYBINDINGS } from "@/lib/types";
import type { KeybindingDef, KeybindingOverrides } from "@/lib/types";
import { formatShortcutKeys } from "@/lib/formatKey";
import styles from "./KeyboardHelpDialog.module.css";

export interface PluginBinding {
  action: string;
  defaultKey: string;
  description: string;
  pluginName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** User's saved overrides (action id → custom key) */
  overrides?: KeybindingOverrides;
  /** Plugin-declared keybindings */
  pluginBindings?: PluginBinding[];
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

export default function KeyboardHelpDialog({
  open,
  onClose,
  overrides = {},
  pluginBindings = [],
}: Props) {
  if (!open) return null;

  // Merge built-ins with user overrides
  const merged: KeybindingDef[] = DEFAULT_KEYBINDINGS.map((def) => ({
    ...def,
    defaultKey: overrides[def.id] ?? def.defaultKey,
  }));

  // Group by category
  const categories = Array.from(new Set(merged.map((d) => d.category)));

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="kbd-help-title" className={styles.title}>
            Keyboard Shortcuts
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {categories.map((cat) => (
            <section key={cat} className={styles.section}>
              <h3 className={styles.sectionTitle}>{cat}</h3>
              <ul className={styles.list}>
                {merged
                  .filter((d) => d.category === cat)
                  .map((def) => (
                    <li key={def.id} className={styles.row}>
                      <span className={styles.actionLabel}>{def.action}</span>
                      <KeyBadges shortcut={def.defaultKey} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}

          {pluginBindings.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Plugins</h3>
              <ul className={styles.list}>
                {pluginBindings.map((pb) => (
                  <li key={pb.action} className={styles.row}>
                    <span className={styles.actionLabel}>
                      {pb.description}
                      <span className={styles.pluginBadge}>{pb.pluginName}</span>
                    </span>
                    <KeyBadges shortcut={overrides[pb.action] ?? pb.defaultKey} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            Customize shortcuts in{" "}
            <a href="/dashboard/settings/keybindings" className={styles.footerLink}>
              Settings → Keybindings
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
