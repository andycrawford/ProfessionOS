"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { UiBackground, UiPanelStyle, UiPreferences } from "@/lib/types";
import { DEFAULT_UI_PREFERENCES } from "@/lib/types";

type Theme = "dark" | "light";

export const ACCENT_PRESETS = [
  { label: "Teal",   value: "#00C9A7" },
  { label: "Blue",   value: "#3D7EFF" },
  { label: "Purple", value: "#7C5FFF" },
  { label: "Orange", value: "#FF7A00" },
  { label: "Rose",   value: "#FF4D6A" },
] as const;

export type AccentPreset = (typeof ACCENT_PRESETS)[number]["value"];

const DEFAULT_ACCENT = ACCENT_PRESETS[0].value; // Teal

// --color-bg-surface per theme — used as default panel tint
const PANEL_TINT_DEFAULTS: Record<Theme, string> = {
  dark:  "#161A1F",
  light: "#FFFFFF",
};

const DEFAULT_BACKGROUND = DEFAULT_UI_PREFERENCES.background!;
const DEFAULT_PANEL_STYLE = DEFAULT_UI_PREFERENCES.panels!;

/** Convert a 6-digit hex color + opacity to an rgba() string. */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Best-effort sync to server. Track A (DVI-159) must land before this succeeds. */
async function syncUiPreferences(prefs: UiPreferences): Promise<void> {
  try {
    await fetch("/api/settings/ui", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
  } catch {
    // localStorage remains the source of truth until the API is deployed.
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  background: UiBackground;
  setBackground: (bg: UiBackground) => void;
  panelStyle: UiPanelStyle;
  setPanelStyle: (style: UiPanelStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {},
  background: DEFAULT_BACKGROUND,
  setBackground: () => {},
  panelStyle: DEFAULT_PANEL_STYLE,
  setPanelStyle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark (matches :root CSS variables) to avoid SSR mismatch.
  // The inline <script> in layout.tsx sets data-theme on <html> before paint,
  // so the visual theme is correct immediately; the React state catches up
  // after mount via useEffect.
  const [theme, setTheme] = useState<Theme>("dark");
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT);
  const [background, setBackgroundState] = useState<UiBackground>(DEFAULT_BACKGROUND);
  const [panelStyle, setPanelStyleState] = useState<UiPanelStyle>(DEFAULT_PANEL_STYLE);

  // ── Initial load from localStorage ─────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("light");
    }

    const storedAccent = localStorage.getItem("accentColor");
    if (storedAccent) {
      setAccentColorState(storedAccent);
      document.documentElement.style.setProperty("--color-accent-brand", storedAccent);
    }

    try {
      const storedUi = localStorage.getItem("uiPreferences");
      if (storedUi) {
        const prefs: UiPreferences = JSON.parse(storedUi);
        if (prefs.background) setBackgroundState(prefs.background);
        if (prefs.panels)    setPanelStyleState(prefs.panels);
      }
    } catch {
      // Ignore malformed localStorage entry.
    }
  }, []);

  // ── Theme → data-theme attribute ───────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ── Panel CSS variables ─────────────────────────────────────────────────────
  // Recomputes whenever panelStyle OR theme changes so that --panel-bg tracks
  // the theme-default tint when no explicit tintColor override is set.
  // (Rule: reset to theme default on theme change unless user overrode tint.)
  useEffect(() => {
    const tint = panelStyle.tintColor ?? PANEL_TINT_DEFAULTS[theme];
    document.documentElement.style.setProperty("--panel-bg", hexToRgba(tint, panelStyle.opacity));
    document.documentElement.style.setProperty("--panel-blur", `${panelStyle.blur}px`);
  }, [panelStyle, theme]);

  // ── Background image CSS variable ──────────────────────────────────────────
  useEffect(() => {
    const value =
      background.type === "preset" && background.presetKey
        ? `url(/wallpapers/${background.presetKey}.svg)`
        : "none";
    document.documentElement.style.setProperty("--bg-image", value);
  }, [background]);

  // ── Public setters ──────────────────────────────────────────────────────────
  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function setAccentColor(color: string) {
    setAccentColorState(color);
    document.documentElement.style.setProperty("--color-accent-brand", color);
    localStorage.setItem("accentColor", color);
  }

  function setBackground(bg: UiBackground) {
    setBackgroundState(bg);
    const prefs: UiPreferences = { background: bg, panels: panelStyle };
    localStorage.setItem("uiPreferences", JSON.stringify(prefs));
    syncUiPreferences(prefs);
  }

  function setPanelStyle(style: UiPanelStyle) {
    setPanelStyleState(style);
    const prefs: UiPreferences = { background, panels: style };
    localStorage.setItem("uiPreferences", JSON.stringify(prefs));
    syncUiPreferences(prefs);
  }

  return (
    <ThemeContext.Provider
      value={{ theme, toggle, accentColor, setAccentColor, background, setBackground, panelStyle, setPanelStyle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
