"use client";

import { Moon, Sun, AlertTriangle } from "lucide-react";
import { useTheme, ACCENT_PRESETS } from "@/components/theme/ThemeProvider";
import styles from "./interface.module.css";

// Wallpaper presets — key must match filenames in /public/wallpapers/
const WALLPAPER_PRESETS = [
  { key: "aurora",    label: "Aurora" },
  { key: "cityglow",  label: "City Glow" },
  { key: "dusk",      label: "Dusk" },
  { key: "ember",     label: "Ember" },
  { key: "forest",    label: "Forest" },
  { key: "midnight",  label: "Midnight" },
  { key: "void",      label: "Void" },
] as const;

// Default panel tint per theme (mirrors PANEL_TINT_DEFAULTS in ThemeProvider)
const PANEL_TINT_DEFAULTS: Record<"dark" | "light", string> = {
  dark:  "#161A1F",
  light: "#FFFFFF",
};

// Contrast warning threshold — below 50% opacity text legibility degrades visibly
const OPACITY_CONTRAST_WARNING_THRESHOLD = 0.5;

export default function InterfaceSettingsPage() {
  const {
    theme, toggle,
    accentColor, setAccentColor,
    background, setBackground,
    panelStyle, setPanelStyle,
  } = useTheme();

  const effectiveTint = panelStyle.tintColor ?? PANEL_TINT_DEFAULTS[theme];

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

      {/* Background section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Background</h2>
        <p className={styles.sectionDesc}>
          Choose a wallpaper for the dashboard background.
        </p>

        <div className={styles.wallpaperGrid} role="radiogroup" aria-label="Wallpaper presets">
          {/* None option */}
          <button
            className={`${styles.wallpaperTile} ${background.type === "none" ? styles.wallpaperTileActive : ""}`}
            onClick={() => setBackground({ type: "none" })}
            aria-pressed={background.type === "none"}
            aria-label="No background wallpaper"
          >
            <div className={styles.wallpaperNone} aria-hidden="true" />
            <span className={styles.wallpaperLabel}>None</span>
          </button>

          {WALLPAPER_PRESETS.map((preset) => {
            const isActive = background.type === "preset" && background.presetKey === preset.key;
            return (
              <button
                key={preset.key}
                className={`${styles.wallpaperTile} ${isActive ? styles.wallpaperTileActive : ""}`}
                onClick={() => setBackground({ type: "preset", presetKey: preset.key })}
                aria-pressed={isActive}
                aria-label={`${preset.label} wallpaper`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/wallpapers/${preset.key}.svg`}
                  alt=""
                  className={styles.wallpaperThumb}
                  aria-hidden="true"
                />
                <span className={styles.wallpaperLabel}>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Panels section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Panels</h2>
        <p className={styles.sectionDesc}>
          Adjust transparency, tint, and blur for panels and cards.
        </p>

        {/* Opacity slider */}
        <div className={styles.sliderRow}>
          <label className={styles.sliderLabel} htmlFor="panel-opacity">
            Opacity
          </label>
          <input
            id="panel-opacity"
            type="range"
            className={styles.slider}
            min={30}
            max={100}
            step={1}
            value={Math.round(panelStyle.opacity * 100)}
            onChange={(e) =>
              setPanelStyle({ ...panelStyle, opacity: parseInt(e.target.value) / 100 })
            }
            aria-valuemin={30}
            aria-valuemax={100}
            aria-valuenow={Math.round(panelStyle.opacity * 100)}
            aria-valuetext={`${Math.round(panelStyle.opacity * 100)}%`}
          />
          <span className={styles.sliderValue}>{Math.round(panelStyle.opacity * 100)}%</span>
        </div>

        {panelStyle.opacity < OPACITY_CONTRAST_WARNING_THRESHOLD && (
          <p className={styles.contrastWarning} role="alert">
            <AlertTriangle size={13} aria-hidden="true" />
            Low opacity may reduce text contrast and legibility.
          </p>
        )}

        {/* Blur slider */}
        <div className={styles.sliderRow}>
          <label className={styles.sliderLabel} htmlFor="panel-blur">
            Blur
          </label>
          <input
            id="panel-blur"
            type="range"
            className={styles.slider}
            min={0}
            max={16}
            step={1}
            value={panelStyle.blur}
            onChange={(e) =>
              setPanelStyle({ ...panelStyle, blur: parseInt(e.target.value) })
            }
            aria-valuemin={0}
            aria-valuemax={16}
            aria-valuenow={panelStyle.blur}
            aria-valuetext={`${panelStyle.blur}px`}
          />
          <span className={styles.sliderValue}>{panelStyle.blur}px</span>
        </div>

        {/* Tint color */}
        <div className={styles.customRow}>
          <label className={styles.customLabel} htmlFor="panel-tint">
            Tint color
          </label>
          <div className={styles.customInputWrap}>
            <input
              id="panel-tint"
              type="color"
              className={styles.colorPicker}
              value={effectiveTint}
              onChange={(e) =>
                setPanelStyle({ ...panelStyle, tintColor: e.target.value })
              }
              aria-label="Panel tint color picker"
            />
            <input
              type="text"
              className={styles.hexInput}
              value={effectiveTint.toUpperCase()}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(val))
                  setPanelStyle({ ...panelStyle, tintColor: val });
              }}
              maxLength={7}
              spellCheck={false}
              aria-label="Panel tint hex value"
            />
            {panelStyle.tintColor !== undefined && (
              <button
                className={styles.resetButton}
                onClick={() =>
                  setPanelStyle({ ...panelStyle, tintColor: undefined })
                }
                aria-label="Reset panel tint to theme default"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
