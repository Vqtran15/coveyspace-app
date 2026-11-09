-- Migration 101: rejoin_with_invite_code RPC
-- Lets an authenticated user who has no profiles row join a group via invite code.
-- This covers the case where a group was deleted and the user had no other group —
-- their profiles row was removed, leaving them logged in but group-less.
--
-- On success:
--   • A new profiles row is created (triggers handle group_memberships and
--     conversation_members automatically via on_profile_insert).
--   • Returns { group_id, group_name }
--
-- Run in Supabase SQL Editor: https://app.supabase.com/project/ktmlyzwpgvhrwfgyoeiq/sql/new

CREATE OR REPLACE FUNCTION rejoin_with_invite_code(p_invite_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_group       community_groups%ROWTYPE;
  v_display_name text;
  v_email        text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- This RPC is only for users with no existing profiles row
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'already has a profile — use join_additional_group instead';
  END IF;

  -- Find the group
  SELECT * INTO v_group
  FROM community_groups
  WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite code';
  END IF;

  -- Get display_name from auth metadata; fall back to email prefix
  SELECT
    COALESCE(
      NULLIF(trim(raw_user_meta_data->>'display_name'), ''),
      split_part(email, '@', 1)
    ),
    email
  INTO v_display_name, v_email
  FROM auth.users WHERE id = v_user_id;

  -- Insert profiles row — triggers fire automatically:
  --   on_profile_insert_membership  → creates group_memberships row
  --   on_profile_insert             → adds user to group conversations
  INSERT INTO profiles (user_id, community_group_id, display_name, role)
  VALUES (v_user_id, v_group.id, v_display_name, 'member');

  RETURN json_build_object(
    'group_id',   v_group.id,
    'group_name', v_group.name
  );
END;
$$;
