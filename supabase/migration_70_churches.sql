-- Migration 70: Churches — multi-group parent entity
-- Enables a church to own multiple community groups and broadcast to them.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).
--
-- SETUP ORDER: run all steps top-to-bottom in one pass.

-- ─── 1. Core tables ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS churches (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Link community groups to a church (nullable — independent groups allowed)
ALTER TABLE community_groups
  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES churches(id) ON DELETE SET NULL;

-- Who is a church admin (separate from group-level profiles.role)
CREATE TABLE IF NOT EXISTS church_roles (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id  uuid NOT NULL REFERENCES churches(id)  ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'admin',
  PRIMARY KEY (user_id, church_id)
);

-- Two conversations auto-created per church: all_members + admins_only
CREATE TABLE IF NOT EXISTS church_conversations (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id  uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('all_members', 'admins_only')),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Membership bridge for church conversations
CREATE TABLE IF NOT EXISTS church_conversation_members (
  conversation_id uuid NOT NULL REFERENCES church_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages in church conversations
CREATE TABLE IF NOT EXISTS church_messages (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id              uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  church_conversation_id uuid NOT NULL REFERENCES church_conversations(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES auth.users(id),
  display_name           text NOT NULL,
  body                   text,
  image_url              text,
  -- For broadcasts: which audience + optional group targeting
  audience               text NOT NULL CHECK (audience IN ('all_members', 'admins_only')),
  target_group_ids       uuid[],  -- NULL = all groups; populated = specific groups only
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT church_message_has_content CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE churches                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_messages             ENABLE ROW LEVEL SECURITY;

-- churches: anyone authenticated can read (needed for signup church picker)
CREATE POLICY "authenticated users read churches" ON churches FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- church_roles: own rows only (app only needs to know if current user is a church admin)
CREATE POLICY "own church roles" ON church_roles FOR SELECT
  USING (user_id = auth.uid());

-- church_conversations: visible if the user is a member
CREATE POLICY "church conversation members read" ON church_conversations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM church_conversation_members
    WHERE conversation_id = church_conversations.id AND user_id = auth.uid()
  ));

-- church_conversation_members: own rows only
CREATE POLICY "own church conversation memberships" ON church_conversation_members FOR SELECT
  USING (user_id = auth.uid());

-- church_messages SELECT: member of the conversation AND message is visible to this user's group
CREATE POLICY "church members read messages" ON church_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM church_conversation_members
      WHERE conversation_id = church_messages.church_conversation_id
        AND user_id = auth.uid()
    )
    AND (
      target_group_ids IS NULL
      OR (
        SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
      ) = ANY(target_group_ids)
    )
  );

-- church_messages INSERT for all_members broadcasts: church admin only
CREATE POLICY "church admin insert all_members" ON church_messages FOR INSERT
  WITH CHECK (
    audience = 'all_members'
    AND EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid() AND church_id = church_messages.church_id
    )
  );

-- church_messages INSERT for admins_only: church admin OR group admin in the church
CREATE POLICY "church admin or group admin insert admins_only" ON church_messages FOR INSERT
  WITH CHECK (
    audience = 'admins_only'
    AND (
      EXISTS (
        SELECT 1 FROM church_roles
        WHERE user_id = auth.uid() AND church_id = church_messages.church_id
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
          AND role = 'admin'
          AND community_group_id IN (
            SELECT id FROM community_groups WHERE church_id = church_messages.church_id
          )
      )
    )
  );

-- ─── 3. Helper functions ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_church_admin(ch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM church_roles WHERE user_id = auth.uid() AND church_id = ch_id)
$$;

-- ─── 4. Triggers ──────────────────────────────────────────────────────────────

-- 4a. Auto-create two church_conversations when a church is inserted
CREATE OR REPLACE FUNCTION create_church_conversations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO church_conversations (church_id, type, name) VALUES
    (NEW.id, 'all_members',  NEW.name || ' · All Members'),
    (NEW.id, 'admins_only',  NEW.name || ' · Leaders');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_church_created ON churches;
CREATE TRIGGER on_church_created
  AFTER INSERT ON churches
  FOR EACH ROW EXECUTE FUNCTION create_church_conversations();

-- 4b. When community_groups.church_id is set, add all existing members to church convs
CREATE OR REPLACE FUNCTION sync_group_to_church_conversations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  all_conv_id    uuid;
  admins_conv_id uuid;
BEGIN
  -- Only act when church_id is newly set (not cleared, not unchanged)
  IF NEW.church_id IS NULL OR NEW.church_id IS NOT DISTINCT FROM OLD.church_id THEN
    RETURN NEW;
  END IF;

  SELECT id INTO all_conv_id    FROM church_conversations WHERE church_id = NEW.church_id AND type = 'all_members';
  SELECT id INTO admins_conv_id FROM church_conversations WHERE church_id = NEW.church_id AND type = 'admins_only';

  -- All group members → all_members conv
  INSERT INTO church_conversation_members (conversation_id, user_id)
    SELECT all_conv_id, user_id FROM profiles WHERE community_group_id = NEW.id
    ON CONFLICT DO NOTHING;

  -- Group admins → admins_only conv
  INSERT INTO church_conversation_members (conversation_id, user_id)
    SELECT admins_conv_id, user_id FROM profiles WHERE community_group_id = NEW.id AND role = 'admin'
    ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_church_linked ON community_groups;
CREATE TRIGGER on_group_church_linked
  AFTER UPDATE OF church_id ON community_groups
  FOR EACH ROW EXECUTE FUNCTION sync_group_to_church_conversations();

-- 4c. When a new profile joins a group that already has a church_id, add to church convs
CREATE OR REPLACE FUNCTION add_new_member_to_church_conversations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  church_id_val  uuid;
  all_conv_id    uuid;
  admins_conv_id uuid;
BEGIN
  SELECT church_id INTO church_id_val FROM community_groups WHERE id = NEW.community_group_id;
  IF church_id_val IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO all_conv_id    FROM church_conversations WHERE church_id = church_id_val AND type = 'all_members';
  SELECT id INTO admins_conv_id FROM church_conversations WHERE church_id = church_id_val AND type = 'admins_only';

  INSERT INTO church_conversation_members (conversation_id, user_id)
    VALUES (all_conv_id, NEW.user_id)
    ON CONFLICT DO NOTHING;

  IF NEW.role = 'admin' THEN
    INSERT INTO church_conversation_members (conversation_id, user_id)
      VALUES (admins_conv_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_insert_church ON profiles;
CREATE TRIGGER on_profile_insert_church
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION add_new_member_to_church_conversations();

-- 4d. When a profile's role changes, sync admins_only membership
CREATE OR REPLACE FUNCTION sync_member_role_to_church_conversations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  church_id_val  uuid;
  admins_conv_id uuid;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;

  SELECT church_id INTO church_id_val FROM community_groups WHERE id = NEW.community_group_id;
  IF church_id_val IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO admins_conv_id FROM church_conversations WHERE church_id = church_id_val AND type = 'admins_only';
  IF admins_conv_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.role = 'admin' THEN
    INSERT INTO church_conversation_members (conversation_id, user_id)
      VALUES (admins_conv_id, NEW.user_id)
      ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM church_conversation_members
      WHERE conversation_id = admins_conv_id AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_role_change_church ON profiles;
CREATE TRIGGER on_profile_role_change_church
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_member_role_to_church_conversations();

-- ─── 5. Update handle_new_user to support church_id at group-creation time ────
-- When someone creates a new group and passes church_id in signup metadata,
-- this sets church_id on the newly created community_groups row. The
-- on_group_church_linked trigger then auto-adds the first admin to church convs
-- (via the subsequent on_profile_insert_church trigger on profiles insert).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp_id     uuid;
  grp_name   text := trim(new.raw_user_meta_data->>'community_group_name');
  inv_code   text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  disp_name  text := trim(new.raw_user_meta_data->>'display_name');
  first_name text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  last_name  text := nullif(trim(new.raw_user_meta_data->>'last_name'),  '');
  church_id  uuid := nullif(trim(new.raw_user_meta_data->>'church_id'), '')::uuid;
  usr_role   text := 'member';
  new_code   text;
BEGIN
  IF disp_name IS NULL OR disp_name = '' THEN RETURN new; END IF;

  IF inv_code IS NOT NULL AND inv_code <> '' THEN
    SELECT id INTO grp_id FROM community_groups WHERE invite_code = inv_code;
    IF grp_id IS NULL THEN
      RAISE EXCEPTION 'Invalid invite code. Please check with your group leader.';
    END IF;

  ELSIF grp_name IS NOT NULL AND grp_name <> '' THEN
    IF EXISTS (SELECT 1 FROM community_groups WHERE name = grp_name) THEN
      RAISE EXCEPTION 'A group with that name already exists. Use an invite code to join it.';
    END IF;
    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM community_groups WHERE invite_code = new_code);
    END LOOP;
    INSERT INTO community_groups (name, invite_code, church_id)
    VALUES (grp_name, new_code, church_id)
    RETURNING id INTO grp_id;
    usr_role := 'admin';

  ELSE
    RETURN new;
  END IF;

  INSERT INTO profiles (user_id, community_group_id, display_name, role, first_name, last_name)
  VALUES (new.id, grp_id, coalesce(nullif(disp_name, ''), 'Member'), usr_role, first_name, last_name);

  RETURN new;
END;
$$;

-- ─── 6. Realtime ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE church_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE church_conversation_members;
