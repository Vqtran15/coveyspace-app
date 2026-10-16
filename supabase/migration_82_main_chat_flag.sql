-- BUG: add_member_to_group_conversations and join_additional_group both use
-- WHERE type = 'group', which matches ALL group conversations including
-- admin-created sub-group chats. New members were being auto-added to every
-- sub-group conversation, not just the Main Group Chat.
--
-- Fix: add is_main_chat boolean to conversations; backfill existing rows;
-- update the trigger and RPC to filter on is_main_chat = true.
--
-- Run in Supabase SQL editor for project ktmlyzwpgvhrwfgyoeiq.

-- 1. Add column
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_main_chat BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill existing Main Group Chats
UPDATE conversations
  SET is_main_chat = true
  WHERE type = 'group' AND name = 'Main Group Chat';

-- 3. Fix create_default_group_conversation to stamp the flag on creation
CREATE OR REPLACE FUNCTION create_default_group_conversation()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  insert into conversations (community_group_id, type, name, is_main_chat)
  values (new.id, 'group', 'Main Group Chat', true);
  return new;
end;
$$;

-- 4. Fix add_member_to_group_conversations — only add to main chat
CREATE OR REPLACE FUNCTION add_member_to_group_conversations()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  insert into conversation_members (conversation_id, user_id)
  select id, new.user_id
  from conversations
  where community_group_id = new.community_group_id
    and type = 'group'
    and is_main_chat = true
  on conflict do nothing;
  return new;
end;
$$;

-- 5. Fix join_additional_group — only add to main chat
CREATE OR REPLACE FUNCTION join_additional_group(p_invite_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group community_groups%ROWTYPE;
  v_existing_role text;
BEGIN
  SELECT * INTO v_group
  FROM community_groups
  WHERE invite_code = upper(trim(p_invite_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid invite code';
  END IF;

  SELECT role INTO v_existing_role
  FROM group_memberships
  WHERE user_id = auth.uid() AND community_group_id = v_group.id;

  IF v_existing_role IS NOT NULL THEN
    RETURN json_build_object(
      'group_id',       v_group.id,
      'group_name',     v_group.name,
      'already_member', true
    );
  END IF;

  INSERT INTO group_memberships (user_id, community_group_id, role)
  VALUES (auth.uid(), v_group.id, 'member');

  -- Only add to the Main Group Chat, not sub-group conversations
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, auth.uid()
  FROM conversations c
  WHERE c.community_group_id = v_group.id
    AND c.type = 'group'
    AND c.is_main_chat = true
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'group_id',       v_group.id,
    'group_name',     v_group.name,
    'already_member', false
  );
END;
$$;

-- 6. Fix create_group_for_current_user — same is_main_chat guard for consistency
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

  LOOP
    v_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text) for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM community_groups WHERE invite_code = v_invite_code);
  END LOOP;

  INSERT INTO community_groups (name, invite_code)
  VALUES (p_group_name, v_invite_code)
  RETURNING id INTO v_group_id;

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

  INSERT INTO group_memberships (user_id, community_group_id, role)
  VALUES (v_user_id, v_group_id, 'admin')
  ON CONFLICT (user_id, community_group_id) DO UPDATE SET role = 'admin';

  UPDATE profiles
  SET community_group_id = v_group_id,
      role               = 'admin'
  WHERE user_id = v_user_id;

  -- Add creator to the Main Group Chat only
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, v_user_id
  FROM conversations c
  WHERE c.community_group_id = v_group_id
    AND c.type = 'group'
    AND c.is_main_chat = true
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'group_id',    v_group_id,
    'group_name',  p_group_name,
    'invite_code', v_invite_code
  );
END;
$$;
