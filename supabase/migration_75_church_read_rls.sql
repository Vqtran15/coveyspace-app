-- migration_75_church_read_rls
--
-- Problem: church_conversation_members has no UPDATE or INSERT policy,
-- so updateLastRead (upsert) fails silently and the ember dot never clears.
--
-- Fix 1: Allow users to update last_read_at on their own membership rows.
-- Fix 2: Allow users to insert their own row when it's missing (upsert needs INSERT).
--        The WITH CHECK guards against a user self-adding to a conversation
--        they don't belong to by requiring a matching group↔church relationship.
-- Fix 3: Backfill any missing church_conversation_members rows for current users
--        (handles users who joined before triggers were in place).

-- ─── 1. UPDATE policy (safe: own row only) ────────────────────────────────────
CREATE POLICY "members update own last_read_at"
  ON church_conversation_members
  FOR UPDATE
  USING (user_id = auth.uid());

-- ─── 2. INSERT policy (guarded: user must belong to a group in the church) ────
CREATE POLICY "members insert own membership"
  ON church_conversation_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM church_conversations cc
        JOIN community_groups cg ON cg.church_id = cc.church_id
        JOIN profiles p ON p.community_group_id = cg.id
       WHERE cc.id = conversation_id
         AND p.user_id = auth.uid()
    )
  );

-- ─── 3. Backfill missing rows ─────────────────────────────────────────────────
-- For each church conversation, add a row for every user whose active group
-- belongs to that church and who is not already in church_conversation_members.
--
-- 'all_members' conversations: add all group members.
-- 'admins_only' conversations: add only group admins.
INSERT INTO church_conversation_members (conversation_id, user_id)
SELECT cc.id, p.user_id
  FROM church_conversations cc
  JOIN community_groups cg ON cg.church_id = cc.church_id
  JOIN profiles p ON p.community_group_id = cg.id
 WHERE cc.type = 'all_members'
   AND NOT EXISTS (
     SELECT 1 FROM church_conversation_members m
      WHERE m.conversation_id = cc.id AND m.user_id = p.user_id
   )
ON CONFLICT DO NOTHING;

INSERT INTO church_conversation_members (conversation_id, user_id)
SELECT cc.id, p.user_id
  FROM church_conversations cc
  JOIN community_groups cg ON cg.church_id = cc.church_id
  JOIN profiles p ON p.community_group_id = cg.id
 WHERE cc.type = 'admins_only'
   AND p.role = 'admin'
   AND NOT EXISTS (
     SELECT 1 FROM church_conversation_members m
      WHERE m.conversation_id = cc.id AND m.user_id = p.user_id
   )
ON CONFLICT DO NOTHING;
