-- Migration 69: Add community_group_id to event_rsvps
-- Enables efficient group-scoped realtime filtering on the event_rsvps channel
-- without a server-side join through events.
--
-- SETUP: Run this in the Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- Step 1: Add the column (nullable first so the backfill can run)
ALTER TABLE event_rsvps
  ADD COLUMN IF NOT EXISTS community_group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE;

-- Step 2: Backfill from the parent events table
UPDATE event_rsvps r
  SET community_group_id = e.community_group_id
  FROM events e
  WHERE r.event_id = e.id;

-- Step 3: Lock it down — no new RSVPs without a group
ALTER TABLE event_rsvps ALTER COLUMN community_group_id SET NOT NULL;

-- Step 4: Replace the join-based SELECT policy with a direct column check
DROP POLICY IF EXISTS "group members read rsvps" ON event_rsvps;

CREATE POLICY "group members read rsvps" ON event_rsvps FOR SELECT
  USING (community_group_id IN (
    SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
  ));
