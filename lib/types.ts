// Shared data types for the real-time data layer.
// Imported by SSE/AI route handlers (server) and client hooks alike.
// Keep these types in sync with the component prop types they feed into.

export type FeedItemSeverity = "critical" | "warning" | "info" | "neutral";
export type FeedService = "mail" | "calendar" | "messaging" | "code" | "crm" | "ai";
export type AlertSeverity = "critical" | "warning" | "info";
export type WidgetServiceKey = "mail" | "calendar" | "messaging" | "code" | "crm";
export type WidgetState = "default" | "warning" | "critical" | "loading" | "empty";

export interface FeedItem {
  id: string;
  severity: FeedItemSeverity;
  service: FeedService;
  title: string;
  subtitle?: string;
  /** HH:MM display string */
  timestamp: string;
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
export interface WidgetPreference {
  key: WidgetServiceKey;
  enabled: boolean;
}

export const DEFAULT_WIDGET_PREFS: WidgetPreference[] = [
  { key: "mail", enabled: true },
  { key: "calendar", enabled: true },
  { key: "messaging", enabled: true },
  { key: "code", enabled: true },
  { key: "crm", enabled: true },
];

// Discriminated union of all SSE event shapes
export type SSEEvent =
  | { type: "ping"; payload: { ts: number } }
  | { type: "feed_item"; payload: FeedItem }
  | { type: "alert"; payload: Alert }
  | { type: "widget_update"; payload: WidgetMetrics };
