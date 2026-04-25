import {
  boolean,
  integer,
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

// Re-export combined schema for DrizzleAdapter and drizzle.config.ts
export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  userSettings,
};
