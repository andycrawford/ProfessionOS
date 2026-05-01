-- Migration 0010: Add dashboards JSONB column to user_settings
-- Stores array of named dashboards, each with its own widget set (DVI-195)

ALTER TABLE "user_settings" ADD COLUMN "dashboards" jsonb;
