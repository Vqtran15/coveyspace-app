-- migration_61_bible.sql
-- Adds bible_enabled feature flag to group_settings.
-- Run via Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

ALTER TABLE group_settings
  ADD COLUMN IF NOT EXISTS bible_enabled BOOLEAN DEFAULT FALSE;
