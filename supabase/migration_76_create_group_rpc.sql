-- Migration 76: RPCs for in-app group creation and church-admin invite code access
-- Run in Supabase SQL Editor: https://app.supabase.com/project/ktmlyzwpgvhrwfgyoeiq/sql/new

-- ── 1. create_group_for_current_user ─────────────────────────────────────────
-- Lets a logged-in user create a brand-new community group and become its admin.
-- After this call:
--   • A new community_groups row exists with a unique invite_code.
--   • A group_settings row is created with the requested feature flags.
--   • A group_memberships row is added for the caller (role = 'admin').
--   • The caller's profiles.community_group_id switches to the new group
--     and profiles.role is set to 'admin'.
-- Returns: { group_id, group_name, invite_code }

CREATE OR REPLACE FUNCTION create_group_for_current_user(
  p_group_name text,
  p_features   jsonb DEFAULT '{}'::jsonb
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_group_id    uuid;
  v_invite_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  p_group_name := trim(p_group_name);
  IF char_length(p_group_name) < 1 THEN
    RAISE EXCEPTION 'group name cannot be empty';
  END IF;

  -- Generate a unique 6-character invite code
  LOOP
    v_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM community_groups WHERE invite_code = v_invite_code);
  END LOOP;

  -- Create the group
  INSERT INTO community_groups (name, invite_code)
  VALUES (p_group_name, v_invite_code)
  RETURNING id INTO v_group_id;

  -- Create group settings with requested features (sensible defaults for new groups)
  INSERT INTO group_settings (
    group_id,
    chat_enabled, prayer_enabled, birthdays_enabled,
    meals_enabled, services_enabled, guide_enabled,
    events_enabled, bible_enabled, giving_enabled
  ) VALUES (
    v_group_id,
    COALESCE((p_features->>'chat_enabled')::boolean,      true),
    COALESCE((p_features->>'prayer_enabled')::boolean,    true),
    COALESCE((p_features->>'birthdays_enabled')::boolean, true),
    COALESCE((p_features->>'meals_enabled')::boolean,     false),
    COALESCE((p_features->>'services_enabled')::boolean,  false),
    COALESCE((p_features->>'guide_enabled')::boolean,     false),
    COALESCE((p_features->>'events_enabled')::boolean,    false),
    COALESCE((p_features->>'bible_enabled')::boolean,     false),
    COALESCE((p_features->>'giving_enabled')::boolean,    false)
  );

  -- Add group membership (admin)
  INSERT INTO group_memberships (user_id, community_group_id, role)
  VALUES (v_user_id, v_group_id, 'admin')
  ON CONFLICT (user_id, community_group_id) DO UPDATE SET role = 'admin';

  -- Switch active group (mirrors switch_active_group logic, combined here for atomicity)
  UPDATE profiles
  SET community_group_id = v_group_id,
      role               = 'admin'
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'group_id',    v_group_id,
    'group_name',  p_group_name,
    'invite_code', v_invite_code
  );
END;
$$;

-- ── 2. get_group_invite_code ──────────────────────────────────────────────────
-- Returns the invite_code for any community group that belongs to the same
-- church as the calling church admin. Prevents a church admin from reading
-- invite codes for groups in other churches.

CREATE OR REPLACE FUNCTION get_group_invite_code(target_group_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite_code text;
BEGIN
  -- Verify the caller is a church admin for the church that owns this group
  IF NOT EXISTS (
    SELECT 1
    FROM church_roles cr
    JOIN community_groups cg ON cg.church_id = cr.church_id
    WHERE cr.user_id = auth.uid()
      AND cg.id = target_group_id
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT invite_code INTO v_invite_code
  FROM community_groups
  WHERE id = target_group_id;

  RETURN v_invite_code;
END;
$$;
