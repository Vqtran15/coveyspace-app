-- BUG-2: Supabase Realtime DELETE payloads only include the old row data when
-- REPLICA IDENTITY is set to FULL. Without this, reaction DELETE events arrive
-- with old_record = null, so the client cannot identify which reaction was
-- removed and cannot update the UI without a full refresh.
--
-- Run this in the Supabase SQL editor for project ktmlyzwpgvhrwfgyoeiq.

ALTER TABLE reactions REPLICA IDENTITY FULL;
