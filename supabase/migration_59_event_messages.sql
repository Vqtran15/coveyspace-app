-- migration_59: Add event_id to messages for event card module in chat.
-- Run via Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
