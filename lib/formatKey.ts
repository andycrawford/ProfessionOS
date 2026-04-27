/**
 * Formats a shortcut key string (useKeyboardShortcuts format) into a
 * display-friendly array of key badge strings.
 *
 * Examples:
 *   "cmd+k"   → ["⌘", "K"]
 *   "shift+?" → ["?"]        (Shift is implicit when key is uppercase/symbol)
 *   "/"       → ["/"]
 *   "escape"  → ["Esc"]
 *   "cmd+/"   → ["⌘", "/"]
 */
export function formatShortcutKeys(shortcut: string): string[] {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts[parts.length - 1];
  const hasCmd = parts.includes("cmd");
  const hasShift = parts.includes("shift");
  const hasAlt = parts.includes("alt");

  const badges: string[] = [];
  if (hasCmd) badges.push("⌘");
  if (hasShift) badges.push("⇧");
  if (hasAlt) badges.push("⌥");

  // Map special key names to symbols
  const KEY_LABELS: Record<string, string> = {
    escape: "Esc",
    enter: "↵",
    backspace: "⌫",
    tab: "Tab",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
  };

  badges.push(KEY_LABELS[key] ?? key.toUpperCase());
  return badges;
}
