-- migration_60: Add image_url to conversations for custom group chat icons.
-- Run via Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS image_url TEXT;
