// ─── Service plugin types ─────────────────────────────────────────────────────

export enum ServiceType {
  Ms365Email = "ms365_email",
  Ms365Calendar = "ms365_calendar",
  GoogleCalendar = "google_calendar",
  ClickUp = "clickup",
  Ziflow = "ziflow",
  NetSuiteInvoices = "netsuite_invoices",
  NetSuiteRMA = "netsuite_rma",
  NetSuiteCRM = "netsuite_crm",
  ClaudeAi = "claude_ai",
  MSTeams = "ms_teams",
}

export type UrgencyLevel = 0 | 1 | 2; // 0=normal, 1=important, 2=urgent

export type ItemStatus = "new" | "seen" | "actioned" | "dismissed";

export type ServiceStatus = "ok" | "error" | "pending" | "polling";

export interface ServiceConfig {
  [key: string]: unknown;
}

export interface ActivityItemData {
  externalId: string;
  itemType: string;
  title: string;
  summary?: string;
  urgency: UrgencyLevel;
  sourceUrl?: string;
  metadata: Record<string, unknown>;
  occurredAt?: Date;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "email" | "password" | "select" | "number" | "checkbox";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
}

/**
 * Optional keyboard shortcut a plugin can declare.
 * The declared key is the default; users can override it in keybinding settings.
 * action must be a stable unique identifier (e.g. "plugin:jira:open").
 */
export interface PluginKeybinding {
  /** Stable action id — used as the key for user overrides */
  action: string;
  /** Default key binding in useKeyboardShortcuts format (e.g. "j", "cmd+j") */
  defaultKey: string;
  /** Human-readable label shown in the shortcuts help dialog */
  description: string;
}

export interface ServicePlugin {
  type: ServiceType;
  displayName: string;
  description: string;
  icon: string; // lucide-react icon name
  color: string; // brand color
  configFields: ConfigField[];
  poll(config: ServiceConfig, credentials: ServiceConfig): Promise<ActivityItemData[]>;
  testConnection(config: ServiceConfig, credentials: ServiceConfig): Promise<boolean>;
  getAuthUrl?(redirectUri: string): string;
  /** Optional: approve/action an item in the external service. Returns true on success. */
  approveItem?(config: ServiceConfig, externalId: string, action: string): Promise<boolean>;
  /** Optional: keyboard shortcut this plugin wants to register. */
  keybinding?: PluginKeybinding;
}
