-- Migration 0009: Add dashboard_widgets JSONB column to user_settings
-- Stores free-form dashboard tile configurations (DVI-195)

ALTER TABLE "user_settings" ADD COLUMN "dashboard_widgets" jsonb;
