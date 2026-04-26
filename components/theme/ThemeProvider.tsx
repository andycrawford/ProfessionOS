"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
  accentColor: DEFAULT_ACCENT,
  setAccentColor: () => {},
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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function setAccentColor(color: string) {
    setAccentColorState(color);
    document.documentElement.style.setProperty("--color-accent-brand", color);
    localStorage.setItem("accentColor", color);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
