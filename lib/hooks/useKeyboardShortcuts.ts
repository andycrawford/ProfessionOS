"use client";

import { useEffect, useRef } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

/**
 * Shortcut key format: modifier(s) joined with "+", then the key.
 * Use "cmd" for Cmd/Ctrl (platform-agnostic), "shift", "alt".
 * Examples: "cmd+k", "cmd+/", "escape", "cmd+shift+p"
 *
 * Shortcuts do NOT fire when focus is inside an input/textarea/select,
 * except "escape" which always fires so modals can be dismissed.
 */
function matches(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];

  const needsCmd = parts.includes("cmd");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");

  // "cmd" matches either Meta (Mac) or Ctrl (Windows/Linux)
  if (needsCmd && !(e.metaKey || e.ctrlKey)) return false;
  if (!needsCmd && (e.metaKey || e.ctrlKey)) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  return e.key.toLowerCase() === key;
}

/**
 * Registers global keyboard shortcuts for the lifetime of the component.
 * The shortcut map can be a new object each render — handlers are kept
 * current via a ref so the listener is only added/removed once.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.isContentEditable;

      for (const [shortcut, handler] of Object.entries(shortcutsRef.current)) {
        if (!matches(e, shortcut)) continue;
        // Allow Escape even when focus is in an input
        if (inInput && shortcut !== "escape") continue;
        e.preventDefault();
        handler(e);
        // Only fire the first matching shortcut
        break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Single listener for lifetime of component
}
