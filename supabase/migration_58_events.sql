-- Migration 58: Events + RSVP
-- For groups that have one-off or irregular gatherings (not recurring meals/services).
--
-- SETUP: Run this in the Supabase dashboard SQL editor (project ktmlyzwpgvhrwfgyoeiq).
--
-- ── New tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  community_group_id UUID         REFERENCES community_groups(id) ON DELETE CASCADE,
  created_by         UUID         REFERENCES profiles(user_id),
  title              TEXT         NOT NULL,
  description        TEXT,
  event_date         DATE         NOT NULL,
  event_time         TIME,
  location           TEXT,
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID        REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES profiles(user_id) ON DELETE CASCADE,
  status     TEXT        CHECK (status IN ('going', 'maybe', 'not_going')) DEFAULT 'going',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ── Feature flag ─────────────────────────────────────────────────────────────

ALTER TABLE group_settings ADD COLUMN IF NOT EXISTS events_enabled BOOLEAN DEFAULT FALSE;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

-- Group members can read events in their group
CREATE POLICY "group members read events" ON events FOR SELECT
  USING (community_group_id IN (
    SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Only admins can create, update, or delete events
CREATE POLICY "admins manage events" ON events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND community_group_id = events.community_group_id
      AND role = 'admin'
  ));

-- Group members can read all RSVPs for events in their group
CREATE POLICY "group members read rsvps" ON event_rsvps FOR SELECT
  USING (event_id IN (
    SELECT e.id FROM events e
    JOIN profiles p ON p.community_group_id = e.community_group_id
    WHERE p.user_id = auth.uid()
  ));

-- Members can create and update their own RSVP
CREATE POLICY "members manage own rsvps" ON event_rsvps FOR ALL
  USING (user_id = auth.uid());
