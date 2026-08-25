-- migration_72_multi_group_fixes
-- Three bugs introduced by the multi-group membership feature (migration_71):
--
-- Bug 1: community_groups RLS only allows reading the ACTIVE group.
--   When db.groupMemberships.fetchAll joins community_groups(name,...), it returns
--   null for every group that isn't the user's current active group, so the Settings
--   page shows "Group" instead of the real name.
--
-- Bug 2: join_additional_group only inserts into group_memberships. The trigger
--   add_member_to_group_conversations fires on profiles INSERT, not on group_memberships
--   INSERT, so a user who joins a second group via invite code is never added to that
--   group's conversation_members. They cannot see the Main Group Chat after switching.
--
-- Bug 3: (Fixed in admin.js) loadMembers queried profiles.community_group_id instead
--   of group_memberships, so users only appeared under their active group in the admin
--   dashboard — not under every group they belong to.


-- ── Fix 1: community_groups RLS ──────────────────────────────────────────────
-- Allow authenticated users to read the community_groups row for any group they
-- belong to (not just their active group).
CREATE POLICY "view joined groups" ON community_groups
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM group_memberships
      WHERE user_id = auth.uid()
        AND community_group_id = community_groups.id
    )
  );


-- ── Fix 2: join_additional_group — also add to conversation_members ───────────
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

  -- Add user to all group-type conversations for the new group so they
  -- can see the Main Group Chat immediately after switching to this group.
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, auth.uid()
  FROM conversations c
  WHERE c.community_group_id = v_group.id AND c.type = 'group'
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'group_id',       v_group.id,
    'group_name',     v_group.name,
    'already_member', false
  );
END;
$$;
