-- Migration 68: Share prayer requests to group chat
-- Adds prayer_request_id column to messages so a prayer request can be
-- shared as a card in the main group chat (mirrors poll_id and event_id).
-- Run via Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

ALTER TABLE messages ADD COLUMN IF NOT EXISTS prayer_request_id UUID REFERENCES prayer_requests(id) ON DELETE SET NULL;

-- Extend the message_has_content constraint to allow prayer-only messages
ALTER TABLE messages DROP CONSTRAINT IF EXISTS message_has_content;

ALTER TABLE messages
  ADD CONSTRAINT message_has_content
  CHECK (body IS NOT NULL OR image_url IS NOT NULL OR poll_id IS NOT NULL OR event_id IS NOT NULL OR prayer_request_id IS NOT NULL);
