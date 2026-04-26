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
};
