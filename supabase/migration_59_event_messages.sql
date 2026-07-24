-- migration_59: Add event_id to messages for event card module in chat.
-- Run via Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

ALTER TABLE messages ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

-- Extend the message_has_content constraint to allow event-only messages
-- (mirrors migration_55 which added poll_id support)
ALTER TABLE messages DROP CONSTRAINT IF EXISTS message_has_content;

ALTER TABLE messages
  ADD CONSTRAINT message_has_content
  CHECK (body IS NOT NULL OR image_url IS NOT NULL OR poll_id IS NOT NULL OR event_id IS NOT NULL);
