// Shared data types for the real-time data layer.
// Imported by SSE/AI route handlers (server) and client hooks alike.
// Keep these types in sync with the component prop types they feed into.

export type FeedItemSeverity = "critical" | "warning" | "info" | "neutral";
export type FeedService = "mail" | "calendar" | "messaging" | "code" | "crm" | "ai";
export type AlertSeverity = "critical" | "warning" | "info";
// Base (static) keys for the five core service tiles
export type BaseWidgetServiceKey = "mail" | "calendar" | "messaging" | "code" | "crm";
// Dynamic netsuite_* keys — one per enabled monitor (e.g. netsuite_po, netsuite_rma)
export type NetsuiteWidgetKey = `netsuite_${string}`;
export type WidgetServiceKey = BaseWidgetServiceKey | NetsuiteWidgetKey;
export type WidgetState = "default" | "warning" | "critical" | "loading" | "empty";

export interface FeedItem {
  id: string;
  severity: FeedItemSeverity;
  service: FeedService;
  title: string;
  subtitle?: string;
  /** HH:MM display string */
  timestamp: string;
  /** OWA or service URL — makes the item row clickable (opens in new tab) */
  sourceUrl?: string;
  /** Teams meeting join URL — shown as a "Join" button; only set for online meetings */
  joinUrl?: string;
  /** How to open sourceUrl: new browser tab (default) or embedded dashboard iframe */
  linkBehavior?: "new_tab" | "embed";
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  summary: string;
  service?: string;
}

export interface WidgetMetrics {
  service: WidgetServiceKey;
  metric: number;
  secondaryLabel: string;
  deltaPercent: number;
  sparkline: number[];
  state: WidgetState;
  alertCount?: number;
}

// Widget display preferences — stored in userSettings.widgetPreferences.
// Array order determines render order; hidden widgets remain in the array.
// label is optional — populated for dynamic netsuite_* tiles where the display
// name cannot be derived from the key alone (e.g. user-defined custom monitors).
export interface WidgetPreference {
  key: WidgetServiceKey;
  enabled: boolean;
  label?: string;
}

export const DEFAULT_WIDGET_PREFS: WidgetPreference[] = [
  { key: "mail", enabled: true },
  { key: "calendar", enabled: true },
  { key: "messaging", enabled: true },
  { key: "code", enabled: true },
  { key: "crm", enabled: true },
];

// ── Dashboard widgets (free-form tiles in the home page center area) ──────────

export type DashboardWidgetType = 'ai_custom' | 'clock' | 'weather';

export interface DashboardWidget {
  id: string;
  title: string;
  content: string;      // plain text / markdown content (used by ai_custom)
  type: DashboardWidgetType;
  x: number;            // left offset in px within center area
  y: number;            // top offset in px within center area
  width: number;        // px
  height: number;       // px
  collapsed: boolean;
  config?: Record<string, unknown>; // widget-type-specific settings
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

/**
 * Describes a single keyboard shortcut action.
 * defaultKey uses the same format as useKeyboardShortcuts:
 * e.g. "e", "cmd+k", "shift+?", "/"
 */
export interface KeybindingDef {
  id: string;
  category: string;
  action: string;
  description: string;
  defaultKey: string;
}

/**
 * User overrides stored in DB — maps action id to a custom key.
 * Only overridden keys are stored; missing = use defaultKey.
 */
export type KeybindingOverrides = Record<string, string>;

/** Built-in keybindings. Keep in sync with DashboardClient shortcuts. */
export const DEFAULT_KEYBINDINGS: KeybindingDef[] = [
  {
    id: "open-command-palette",
    category: "System",
    action: "Open Command Palette",
    description: "Search commands and navigate",
    defaultKey: "cmd+k",
  },
  {
    id: "open-command-line",
    category: "System",
    action: "Open Command Line",
    description: "Quick command entry",
    defaultKey: "/",
  },
  {
    id: "show-shortcuts",
    category: "System",
    action: "Show Keyboard Shortcuts",
    description: "Open this help dialog",
    defaultKey: "shift+?",
  },
  {
    id: "toggle-ai",
    category: "Navigation",
    action: "Toggle AI Assistant",
    description: "Show or hide the AI panel",
    defaultKey: "cmd+/",
  },
  {
    id: "nav-mail",
    category: "Navigation",
    action: "Go to Mail",
    description: "Navigate to the Mail section",
    defaultKey: "e",
  },
  {
    id: "nav-calendar",
    category: "Navigation",
    action: "Go to Calendar",
    description: "Navigate to the Calendar section",
    defaultKey: "c",
  },
  {
    id: "nav-messaging",
    category: "Navigation",
    action: "Go to Messaging",
    description: "Navigate to the Messaging section",
    defaultKey: "m",
  },
];

// ── UI Preferences ────────────────────────────────────────────────────────────

/**
 * User-configurable background image setting.
 * 'url' and 'upload' types are reserved for future tracks.
 */
export interface UiBackground {
  type: 'none' | 'preset';
  presetKey?: string; // e.g. "mountains-dusk" → /wallpapers/mountains-dusk.jpg
}

/**
 * User-configurable panel appearance.
 * tintColor: undefined means "use theme default" (auto-resets on theme change).
 */
export interface UiPanelStyle {
  opacity: number;     // 0.0–1.0, default 1.0; floor at 0.3 for accessibility
  tintColor?: string;  // hex override; falls back to theme surface color when absent
  blur: number;        // px, 0–16, default 0 (backdrop-filter intensity)
}

/**
 * Stored in userSettings.uiPreferences (JSONB) and mirrored in localStorage.
 * Shape matches GET/PATCH /api/settings/ui (Track A, DVI-159).
 */
export interface UiPreferences {
  background?: UiBackground;
  panels?: UiPanelStyle;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  background: { type: 'none' },
  panels: { opacity: 1.0, blur: 0 },
};

// Discriminated union of all SSE event shapes
export type SSEEvent =
  | { type: "ping"; payload: { ts: number } }
  | { type: "feed_item"; payload: FeedItem }
  | { type: "alert"; payload: Alert }
  | { type: "widget_update"; payload: WidgetMetrics };
