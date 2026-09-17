-- Migration 86: Add edited_at timestamp to messages
-- Allows the UI to show an "(edited)" label on messages that have been edited.
-- NULL means the message was never edited.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
