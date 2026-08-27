-- Migration 80: Fix set_member_role for multi-group world
--
-- Bug: set_member_role checked profiles.community_group_id to locate the target user.
-- In multi-group world a user's active group (profiles.community_group_id) may differ
-- from the group the admin is managing, so the WHERE clause matched zero rows when the
-- target user's active group was not the admin's current group — silently doing nothing.
--
-- Fix: update group_memberships directly (the authoritative per-group role source).
-- Also update profiles.role if the target user's active group happens to be the same
-- group being changed, so that the denormalized cache stays in sync.
--
-- Run in Supabase SQL Editor: https://app.supabase.com/project/ktmlyzwpgvhrwfgyoeiq/sql/new

CREATE OR REPLACE FUNCTION set_member_role(target_user_id uuid, new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp_id       uuid := current_community_group_id();
  admin_count  int;
BEGIN
  IF NOT is_group_admin() THEN
    RAISE EXCEPTION 'Only admins can change member roles';
  END IF;

  IF new_role NOT IN ('member', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Verify target user is a member of this group (via group_memberships, not profiles.community_group_id)
  IF NOT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE user_id = target_user_id AND community_group_id = grp_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of your group';
  END IF;

  -- Prevent leaving the group without at least one admin
  IF new_role = 'member' THEN
    SELECT COUNT(*) INTO admin_count
    FROM group_memberships
    WHERE community_group_id = grp_id AND role = 'admin';

    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'There must be at least one admin in the group';
    END IF;
  END IF;

  -- Update group_memberships (authoritative per-group role)
  UPDATE group_memberships
  SET role = new_role
  WHERE user_id = target_user_id AND community_group_id = grp_id;

  -- Also update profiles.role if the target user's active group is this group,
  -- so the denormalized cache stays in sync immediately.
  UPDATE profiles
  SET role = new_role
  WHERE user_id = target_user_id AND community_group_id = grp_id;
END;
$$;
