-- migration_71_group_memberships
-- Adds multi-group membership support.
-- profiles.community_group_id stays as the "active group" — zero RLS rewrites needed.
-- group_memberships is the authoritative record of all groups a user belongs to.

-- 1. Join table
CREATE TABLE IF NOT EXISTS group_memberships (
  user_id            uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  community_group_id uuid NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  role               text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at          timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, community_group_id)
);

-- 2. Backfill: every existing user's current group becomes their first membership
INSERT INTO group_memberships (user_id, community_group_id, role)
SELECT user_id, community_group_id, role FROM profiles
ON CONFLICT DO NOTHING;

-- 3. RLS
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;

-- Users can always see their own memberships (needed for the group switcher)
CREATE POLICY "users see own memberships" ON group_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Group admins can see all memberships within their active group
CREATE POLICY "group admins see memberships in their group" ON group_memberships
  FOR SELECT USING (
    community_group_id = current_community_group_id()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Trigger: auto-create membership row when a new profile is inserted
--    This covers both the handle_new_user path and any future profile creation paths.
CREATE OR REPLACE FUNCTION add_membership_on_profile_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO group_memberships (user_id, community_group_id, role)
  VALUES (NEW.user_id, NEW.community_group_id, NEW.role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_insert_membership
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION add_membership_on_profile_insert();

-- 5. Trigger: keep group_memberships.role in sync when profiles.role changes
CREATE OR REPLACE FUNCTION sync_membership_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE group_memberships
    SET role = NEW.role
  WHERE user_id = NEW.user_id AND community_group_id = NEW.community_group_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_role_change_membership
AFTER UPDATE OF role ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_membership_role();

-- 6. RPC: switch the user's active group (validates membership first)
CREATE OR REPLACE FUNCTION switch_active_group(target_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE user_id = auth.uid() AND community_group_id = target_group_id
  ) THEN
    RAISE EXCEPTION 'not a member of that group';
  END IF;
  UPDATE profiles SET community_group_id = target_group_id WHERE user_id = auth.uid();
END;
$$;

-- 7. RPC: join a second group via invite code
--    Does NOT auto-switch the active group — user switches manually.
--    Returns: { group_id, group_name, already_member }
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
      'group_id',      v_group.id,
      'group_name',    v_group.name,
      'already_member', true
    );
  END IF;

  INSERT INTO group_memberships (user_id, community_group_id, role)
  VALUES (auth.uid(), v_group.id, 'member');

  RETURN json_build_object(
    'group_id',      v_group.id,
    'group_name',    v_group.name,
    'already_member', false
  );
END;
$$;
