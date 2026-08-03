-- Migration 65: Group prayer requests
-- Allows a prayer request to be shared across multiple group members.
-- group_prayer_requests: the request itself + tagged member_user_ids array
-- group_prayer_reactions: separate reaction table (doesn't touch prayer_reactions)

CREATE TABLE group_prayer_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_group_id uuid NOT NULL DEFAULT current_community_group_id() REFERENCES community_groups(id) ON DELETE CASCADE,
  member_user_ids    uuid[] NOT NULL,
  request            text NOT NULL,
  added_by           text NOT NULL DEFAULT '',
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  answered           boolean NOT NULL DEFAULT false,
  answered_at        timestamptz
);

ALTER TABLE group_prayer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members" ON group_prayer_requests
  FOR ALL
  USING  (community_group_id = current_community_group_id())
  WITH CHECK (community_group_id = current_community_group_id());

CREATE TABLE group_prayer_reactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_prayer_request_id uuid NOT NULL REFERENCES group_prayer_requests(id) ON DELETE CASCADE,
  community_group_id      uuid NOT NULL DEFAULT current_community_group_id() REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name            text,
  avatar_icon             text,
  avatar_color            text,
  avatar_image_url        text,
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(group_prayer_request_id, user_id)
);

ALTER TABLE group_prayer_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members" ON group_prayer_reactions
  FOR ALL
  USING  (community_group_id = current_community_group_id())
  WITH CHECK (community_group_id = current_community_group_id());
