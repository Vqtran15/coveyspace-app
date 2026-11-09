-- Migration 100: delete_current_group RPC
-- Lets a group admin permanently delete their active group.
-- After this call:
--   • All group data is deleted (messages, prayers, events, birthdays, etc.).
--   • Every member whose active group was this one is switched to their next
--     group membership, or NULL if they have no other memberships.
--   • The community_groups row is deleted; ON DELETE CASCADE handles:
--       group_memberships, group_settings, conversations, messages, reactions,
--       polls, events, group_prayer, and other cascade-linked tables.
--   • Tables without a cascade FK are deleted explicitly first:
--       prayer_friends (cascades → prayer_requests → prayer_reactions),
--       birthdays, meal_pages, signups, serving_pages, serving_signups.
-- Returns: { switched_to: uuid | null }
--   switched_to — the caller's new active group_id, or null if they have none.
-- Run in Supabase SQL Editor: https://app.supabase.com/project/ktmlyzwpgvhrwfgyoeiq/sql/new

CREATE OR REPLACE FUNCTION delete_current_group()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_group_id   uuid;
  v_role       text;
  v_next_group uuid;
  v_next_role  text;
  v_member     RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Get the caller's current group and role
  SELECT community_group_id, role INTO v_group_id, v_role
  FROM profiles WHERE user_id = v_user_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'no active group';
  END IF;

  IF v_role != 'admin' THEN
    RAISE EXCEPTION 'only admins can delete a group';
  END IF;

  -- For every member currently in this group, switch their active group away.
  -- We do this BEFORE deleting the community_groups row so group_memberships
  -- still exists and we can find each member's next available group.
  FOR v_member IN (
    SELECT gm.user_id
    FROM group_memberships gm
    WHERE gm.community_group_id = v_group_id
  ) LOOP
    v_next_group := NULL;
    v_next_role  := NULL;

    SELECT gm2.community_group_id, gm2.role
      INTO v_next_group, v_next_role
      FROM group_memberships gm2
     WHERE gm2.user_id = v_member.user_id
       AND gm2.community_group_id != v_group_id
     LIMIT 1;

    -- Only update profiles rows whose active group is this one
    UPDATE profiles
       SET community_group_id = v_next_group,
           role               = COALESCE(v_next_role, role)
     WHERE user_id = v_member.user_id
       AND community_group_id = v_group_id;
  END LOOP;

  -- Remember what group the caller was switched to (read after profile update)
  SELECT community_group_id INTO v_next_group
  FROM profiles WHERE user_id = v_user_id;

  -- Explicitly delete tables that have no ON DELETE CASCADE from community_groups.
  -- Delete child rows before parents to avoid FK violations.
  DELETE FROM signups         WHERE community_group_id = v_group_id;
  DELETE FROM serving_signups WHERE community_group_id = v_group_id;
  DELETE FROM meal_pages      WHERE community_group_id = v_group_id;
  DELETE FROM serving_pages   WHERE community_group_id = v_group_id;
  DELETE FROM prayer_friends  WHERE community_group_id = v_group_id;  -- cascades prayer_requests → prayer_reactions
  DELETE FROM birthdays       WHERE community_group_id = v_group_id;

  -- Delete the group — cascades: group_memberships, group_settings,
  -- conversations, messages, reactions, polls, events, and group_prayer tables.
  DELETE FROM community_groups WHERE id = v_group_id;

  RETURN json_build_object('switched_to', v_next_group);
END;
$$;
