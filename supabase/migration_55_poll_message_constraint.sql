-- Migration 55: Allow poll-only messages (body and image_url both null when poll_id is set)
--
-- The original message_has_content constraint requires body OR image_url to be non-null.
-- Poll messages have neither — they carry a poll_id instead. Extend the constraint to allow it.
--
-- Run this in the Supabase SQL editor:

ALTER TABLE messages DROP CONSTRAINT IF EXISTS message_has_content;

ALTER TABLE messages
  ADD CONSTRAINT message_has_content
  CHECK (body IS NOT NULL OR image_url IS NOT NULL OR poll_id IS NOT NULL);
