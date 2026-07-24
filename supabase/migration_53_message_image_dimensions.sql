-- Migration 53: Store image dimensions on messages for layout-shift-free chat loading
--
-- Run this in the Supabase SQL editor:
--
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_width  INTEGER,
  ADD COLUMN IF NOT EXISTS image_height INTEGER;
--
-- After this migration:
--   • New image messages will have image_width/image_height set at upload time
--   • Old messages without dimensions fall back to the pre-migration render (no reserved space)
--   • The chat reveal skips img.decode() entirely for messages with known dimensions,
--     eliminating the slow-load skeleton for image-heavy group chats
