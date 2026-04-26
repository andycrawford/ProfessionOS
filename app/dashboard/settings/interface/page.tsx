"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, ACCENT_PRESETS } from "@/components/theme/ThemeProvider";
import styles from "./interface.module.css";

export default function InterfaceSettingsPage() {
  const { theme, toggle, accentColor, setAccentColor } = useTheme();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Interface</h1>
        <p className={styles.subheading}>
          Customize the appearance of Profession OS.
        </p>
      </div>

      {/* Theme section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Theme</h2>
        <p className={styles.sectionDesc}>
          Choose between dark and light mode, or let the system decide.
        </p>
        <div className={styles.themeOptions}>
          <button
            className={`${styles.themeCard} ${theme === "dark" ? styles.themeCardActive : ""}`}
            onClick={() => { if (theme !== "dark") toggle(); }}
            aria-pressed={theme === "dark"}
          >
            <div className={styles.themePreview} data-preview="dark">
              <Moon size={20} aria-hidden="true" />
            </div>
            <span className={styles.themeLabel}>Dark</span>
          </button>

          <button
            className={`${styles.themeCard} ${theme === "light" ? styles.themeCardActive : ""}`}
            onClick={() => { if (theme !== "light") toggle(); }}
            aria-pressed={theme === "light"}
          >
            <div className={styles.themePreview} data-preview="light">
              <Sun size={20} aria-hidden="true" />
            </div>
            <span className={styles.themeLabel}>Light</span>
          </button>
        </div>
      </section>

      {/* Accent color section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Accent Color</h2>
        <p className={styles.sectionDesc}>
          Set the accent color used for active states, CTAs, and AI highlights.
        </p>

        <div className={styles.presets}>
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`${styles.swatch} ${accentColor === preset.value ? styles.swatchActive : ""}`}
              style={{ "--swatch-color": preset.value } as React.CSSProperties}
              onClick={() => setAccentColor(preset.value)}
              aria-label={`${preset.label} accent color`}
              aria-pressed={accentColor === preset.value}
            />
          ))}
        </div>

        <div className={styles.customRow}>
          <label className={styles.customLabel} htmlFor="accent-custom">
            Custom color
          </label>
          <div className={styles.customInputWrap}>
            <input
              id="accent-custom"
              type="color"
              className={styles.colorPicker}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              aria-label="Custom accent color picker"
            />
            <input
              type="text"
              className={styles.hexInput}
              value={accentColor.toUpperCase()}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) setAccentColor(val);
              }}
              maxLength={7}
              spellCheck={false}
              aria-label="Hex color value"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
