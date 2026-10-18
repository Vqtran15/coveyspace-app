-- Migration 97: Allow viewing profiles of group co-members regardless of active group
--
-- Problem:
--   The existing profiles RLS policy only lets you see profiles where
--   community_group_id = current_community_group_id() (the viewer's active group).
--
--   profiles.community_group_id reflects a user's LAST ACTIVE group, not all groups
--   they belong to. If a Group Leader's last active group is Group A, but you're
--   viewing Group B's Leadership card, their profile has community_group_id = Group A
--   and is invisible — even though they're a legitimate member of Group B per
--   group_memberships.
--
--   This causes the Leadership card (and AdminPage member list) to silently drop any
--   member who hasn't recently been active in the group being viewed.
--
-- Fix:
--   Add a second SELECT policy that allows seeing a profile if that user is a member
--   of your current active group in group_memberships.
--
-- Run in Supabase SQL Editor:

CREATE POLICY "view co-members profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm
      WHERE gm.user_id    = profiles.user_id
        AND gm.community_group_id = current_community_group_id()
    )
  );
