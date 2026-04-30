import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Auth tables (NextAuth v5 / @auth/drizzle-adapter) ─────────────────────────
// Column names and types must satisfy DefaultPostgresSchema from the adapter.

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ── App-specific tables ───────────────────────────────────────────────────────

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pollIntervalSeconds: integer("poll_interval_seconds").default(30).notNull(),
  // HH:MM UTC, e.g. "08:00"
  digestTimeUtc: text("digest_time_utc").default("08:00").notNull(),
  aiModel: text("ai_model").default("claude-sonnet-4-6").notNull(),
  theme: text("theme").default("system").notNull(),
  // Array of { key, enabled } ordered by display position. Null = use defaults.
  widgetPreferences: jsonb("widget_preferences"),
  // Record<actionId, customKey> — user overrides for keyboard shortcuts. Null = use defaults.
  keybindings: jsonb("keybindings"),
  // UiPreferences shape — background and panel appearance. Null = use DEFAULT_UI_PREFERENCES.
  uiPreferences: jsonb("ui_preferences"),
});

// ── Plugin system tables ──────────────────────────────────────────────────────

// One row per service plugin instance a user has connected.
// config: non-secret settings (mailbox, lookback window, etc.)
// credentials: encrypted-at-rest secrets (access_token, api_key, etc.)
export const connectedServices = pgTable("connected_services", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Matches ServiceType enum values in services/types.ts
  type: text("type").notNull(),
  displayName: text("display_name").notNull(),
  config: jsonb("config").notNull().default({}),
  credentials: jsonb("credentials").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  // "ok" | "error" | "pending" | "polling"
  status: text("status").notNull().default("pending"),
  lastPollAt: timestamp("last_poll_at", { mode: "date" }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Unified activity feed — all items from all plugins land here.
// urgency: 0=normal, 1=important, 2=urgent
// status: "new" | "seen" | "actioned" | "dismissed"
export const activityItems = pgTable("activity_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => connectedServices.id, {
    onDelete: "set null",
  }),
  // Unique identifier from the external service (email message-id, event id, etc.)
  externalId: text("external_id").notNull(),
  itemType: text("item_type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  urgency: integer("urgency").notNull().default(0),
  status: text("status").notNull().default("new"),
  sourceUrl: text("source_url"),
  // Flexible per-plugin payload (sender, attendees, due date, etc.)
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  actionedAt: timestamp("actioned_at", { mode: "date" }),
});

// User-defined rules that override urgency scoring from plugins.
export const priorityRules = pgTable("priority_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Optional: limit rule to a specific service type
  serviceType: text("service_type"),
  keyword: text("keyword"),
  sender: text("sender"),
  // 0 | 1 | 2 — forces urgency to this level when the rule matches
  urgencyOverride: integer("urgency_override").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── AI chat tables ────────────────────────────────────────────────────────────

// One row per chat session a user starts with the AI assistant.
// title is auto-generated from the first message (max 80 chars).
export const aiConversations = pgTable("ai_conversations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Individual messages within a conversation.
// role: "user" | "assistant"
export const aiMessages = pgTable("ai_messages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Organization / SSO tables ─────────────────────────────────────────────────

// One row per enterprise tenant. domain is used for sign-in domain detection.
// SSO fields (entraIdTenantId, ssoClientId, ssoClientSecret) are nullable until SSO is configured.
export const organizations = pgTable("organizations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // Unique — used to match user email domain to an org at sign-in
  domain: text("domain").notNull().unique(),
  // Entra ID tenant ID — set when Azure AD SSO is configured
  entraIdTenantId: text("entra_id_tenant_id"),
  ssoClientId: text("sso_client_id"),
  // Stored encrypted at rest
  ssoClientSecret: text("sso_client_secret"),
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  // Optional logo URL for white-labeling — shown in the topbar instead of the default logo
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Membership join table linking users to organizations.
// role: 'admin' can manage SSO config; 'member' is a regular org user.
export const organizationMembers = pgTable("organization_members", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
});

// ── AI-generated custom plugins ───────────────────────────────────────────────

// Stores plugins generated by Claude at the user's request from the AI chat interface.
// code: a JavaScript object literal (no imports) implementing the ServicePlugin interface.
// Evaluated at runtime with Function() — user-authored, affects only that user's session.
// Upgrade path: replace Function() eval with a proper sandbox when native modules are available.
export const customPlugins = pgTable("custom_plugins", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Unique plugin type identifier per user (e.g. "jira", "notion")
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  // Full JavaScript object literal implementing ServicePlugin (no import statements)
  code: text("code").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Automation tables ─────────────────────────────────────────────────────────

// One row per user-created automation on a code_automation plugin instance.
// triggerType: "manual" | "schedule" | "event"
// writeMode: "read_only" | "read_write" — read_write is reserved for Phase 2
export const automations = pgTable("automations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pluginServiceId: text("plugin_service_id")
    .notNull()
    .references(() => connectedServices.id, { onDelete: "cascade" }),
  aiServiceId: text("ai_service_id").references(() => connectedServices.id, {
    onDelete: "set null",
  }),
  aiConversationId: text("ai_conversation_id").references(
    () => aiConversations.id,
    { onDelete: "set null" }
  ),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  triggerType: text("trigger_type").notNull().default("manual"),
  // Schedule: { cron: "0 9 * * 1" }; Event: { serviceType, conditions: [...] }
  triggerConfig: jsonb("trigger_config").notNull().default({}),
  targetServiceIds: jsonb("target_service_ids").notNull().default([]),
  // Structured action config — no eval; validated against allowed action types
  actionConfig: jsonb("action_config").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  // "read_only" | "read_write" — read_write greyed out in Phase 1
  writeMode: text("write_mode").notNull().default("read_only"),
  lastRunAt: timestamp("last_run_at", { mode: "date" }),
  lastRunStatus: text("last_run_status"),
  lastRunOutput: jsonb("last_run_output"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// One row per automation execution (dry-run or live).
export const automationRuns = pgTable("automation_runs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  automationId: text("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isDryRun: boolean("is_dry_run").notNull().default(false),
  // "pending" | "running" | "success" | "error"
  status: text("status").notNull().default("pending"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Audit trail — records significant user and system actions.
export const activityLog = pgTable("activity_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  targetId: text("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Re-export combined schema for DrizzleAdapter and drizzle.config.ts
export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  userSettings,
  connectedServices,
  activityItems,
  priorityRules,
  activityLog,
  aiConversations,
  aiMessages,
  organizations,
  organizationMembers,
  customPlugins,
  automations,
  automationRuns,
};
