-- Migration 77: Fix two bugs with in-app group creation
--
-- Bug 1 (birthday card empty after group switch / new group creation):
--   sync_profile_birthday fires on UPDATE OF birthday, display_name — but not on
--   community_group_id. When the user creates a new group or switches active groups,
--   profiles.community_group_id changes but the trigger does not fire, so the
--   birthdays row keeps pointing to the old group_id. The birthday RLS filters by
--   current_community_group_id(), so the user's own birthday is invisible in the
--   new group.
--   Fix: add community_group_id to the trigger's UPDATE OF clause and update it in
--   the ON CONFLICT DO UPDATE clause.
--
-- Bug 2 (no Main Group Chat for newly created groups):
--   create_group_for_current_user inserts into community_groups (which triggers the
--   auto-create of the Main Group Chat conversation) but never adds the creator to
--   conversation_members. The creator can switch to the new group and finds an empty
--   Chat tab because they have no membership in that conversation.
--   Fix: after the INSERT into community_groups, also INSERT the creator into
--   conversation_members for every group-type conversation in the new group.

-- ── Fix 1: birthday sync includes community_group_id ────────────────────────

CREATE OR REPLACE FUNCTION sync_profile_birthday()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF new.birthday IS NOT NULL AND new.display_name IS NOT NULL THEN
    INSERT INTO birthdays (name, birthday, community_group_id, profile_user_id)
    VALUES (new.display_name, new.birthday, new.community_group_id, new.user_id)
    ON CONFLICT (profile_user_id)
    DO UPDATE SET
      birthday           = excluded.birthday,
      name               = excluded.name,
      community_group_id = excluded.community_group_id;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS sync_birthday_on_profile_update ON profiles;
CREATE TRIGGER sync_birthday_on_profile_update
  AFTER INSERT OR UPDATE OF birthday, display_name, community_group_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_birthday();

-- Backfill: update existing birthdays rows to match the owner's current active group
UPDATE birthdays b
SET community_group_id = p.community_group_id
FROM profiles p
WHERE b.profile_user_id = p.user_id
  AND b.community_group_id <> p.community_group_id;


-- ── Fix 2: creator added to conversation_members on group creation ───────────

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

  -- Create the group (triggers create_default_group_conversation → Main Group Chat)
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

  -- Add creator to the auto-created Main Group Chat (and any other group-type convos)
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, v_user_id
  FROM conversations c
  WHERE c.community_group_id = v_group_id AND c.type = 'group'
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'group_id',    v_group_id,
    'group_name',  p_group_name,
    'invite_code', v_invite_code
  );
END;
$$;
