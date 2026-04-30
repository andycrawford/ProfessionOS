-- Migration 0009: Add automations and automation_runs tables for code_automation plugin

CREATE TABLE "automations" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "plugin_service_id" text NOT NULL REFERENCES "connected_services"("id") ON DELETE CASCADE,
  "ai_service_id" text REFERENCES "connected_services"("id") ON DELETE SET NULL,
  "ai_conversation_id" text REFERENCES "ai_conversations"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "trigger_type" text NOT NULL DEFAULT 'manual',
  "trigger_config" jsonb NOT NULL DEFAULT '{}',
  "target_service_ids" jsonb NOT NULL DEFAULT '[]',
  "action_config" jsonb NOT NULL DEFAULT '{}',
  "enabled" boolean NOT NULL DEFAULT true,
  "write_mode" text NOT NULL DEFAULT 'read_only',
  "last_run_at" timestamp,
  "last_run_status" text,
  "last_run_output" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "automation_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "automation_id" text NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_dry_run" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'pending',
  "output" jsonb,
  "error" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
