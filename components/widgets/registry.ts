// Dashboard widget registry — modular pattern matching service plugin registry.
// Built-in widgets register here; the settings page and tile renderer look them up.

import type { DashboardWidgetType } from "@/lib/types";

export interface WidgetConfigField {
  key: string;
  label: string;
  type: "text" | "select";
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface BuiltinWidgetDef {
  type: DashboardWidgetType;
  displayName: string;
  description: string;
  icon: string; // lucide-react icon name
  defaultConfig: Record<string, unknown>;
  defaultWidth: number;
  defaultHeight: number;
  configFields: WidgetConfigField[];
}

const registry = new Map<DashboardWidgetType, BuiltinWidgetDef>();

export function registerWidget(def: BuiltinWidgetDef): void {
  registry.set(def.type, def);
}

export function getWidgetDef(
  type: DashboardWidgetType,
): BuiltinWidgetDef | undefined {
  return registry.get(type);
}

export function getAllWidgetDefs(): BuiltinWidgetDef[] {
  return Array.from(registry.values());
}

export function getBuiltinTypes(): DashboardWidgetType[] {
  return Array.from(registry.keys());
}

// ── Register built-in widgets ────────────────────────────────────────────────

const TIMEZONE_OPTIONS = [
  { label: "Local (browser)", value: "local" },
  { label: "UTC", value: "UTC" },
  { label: "US/Eastern", value: "America/New_York" },
  { label: "US/Central", value: "America/Chicago" },
  { label: "US/Mountain", value: "America/Denver" },
  { label: "US/Pacific", value: "America/Los_Angeles" },
  { label: "US/Alaska", value: "America/Anchorage" },
  { label: "US/Hawaii", value: "Pacific/Honolulu" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Europe/Paris", value: "Europe/Paris" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
];

registerWidget({
  type: "clock",
  displayName: "Clock",
  description: "Digital clock with configurable format and timezone.",
  icon: "Clock",
  defaultConfig: { format: "12h", timezone: "local" },
  defaultWidth: 220,
  defaultHeight: 160,
  configFields: [
    {
      key: "format",
      label: "Time Format",
      type: "select",
      options: [
        { label: "12-hour", value: "12h" },
        { label: "24-hour", value: "24h" },
      ],
    },
    {
      key: "timezone",
      label: "Timezone",
      type: "select",
      options: TIMEZONE_OPTIONS,
    },
  ],
});

registerWidget({
  type: "weather",
  displayName: "Weather",
  description: "Current weather conditions for a configured location.",
  icon: "CloudSun",
  defaultConfig: { city: "", state: "", country: "US" },
  defaultWidth: 260,
  defaultHeight: 200,
  configFields: [
    {
      key: "city",
      label: "City",
      type: "text",
      placeholder: "e.g. San Francisco",
    },
    {
      key: "state",
      label: "State / Region",
      type: "text",
      placeholder: "e.g. CA",
    },
    {
      key: "country",
      label: "Country",
      type: "text",
      placeholder: "e.g. US",
    },
  ],
});
