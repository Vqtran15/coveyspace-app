-- Migration 54: Poll messages in group chat
--
-- Run this in the Supabase SQL editor:

CREATE TABLE IF NOT EXISTS polls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  conversation_id    UUID REFERENCES conversations(id) ON DELETE CASCADE,
  question           TEXT NOT NULL,
  options            JSONB NOT NULL,       -- array of { text: string }
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id      UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)           -- one vote per user per poll; upsert to change vote
);

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS poll_id UUID REFERENCES polls(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Group members can view polls in their group
CREATE POLICY "group_members_view_polls"
  ON polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.community_group_id = polls.community_group_id
    )
  );

-- Group members can create polls
CREATE POLICY "group_members_create_polls"
  ON polls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.community_group_id = polls.community_group_id
    )
  );

-- Group members can view votes on any poll in their group
CREATE POLICY "group_members_view_poll_votes"
  ON poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls
      JOIN profiles ON profiles.community_group_id = polls.community_group_id
      WHERE polls.id = poll_votes.poll_id
        AND profiles.user_id = auth.uid()
    )
  );

-- Members can cast / change their own vote (upsert = INSERT + UPDATE)
CREATE POLICY "members_cast_vote_insert"
  ON poll_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "members_cast_vote_update"
  ON poll_votes FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- After applying:
--   • Enable Realtime on the poll_votes table in Supabase Dashboard
--     (Table Editor → poll_votes → Realtime toggle)
--   • New poll messages will have poll_id set; body and image_url will be null
