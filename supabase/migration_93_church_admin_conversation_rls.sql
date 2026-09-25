-- migration_93_church_admin_conversation_rls
--
-- Problem: church_conversations SELECT policy only allows users who are in
-- church_conversation_members. A church admin whose active group is not linked
-- to the church was never added to that table, so fetchConversations returns []
-- and ResourcesTab hangs in skeleton mode.
--
-- Fix: Add SELECT policies allowing church admins to read conversations and
-- messages in any church where they hold a church_roles row.

-- Allow church admins to read all conversations for their church
CREATE POLICY "church admins read their conversations" ON church_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid() AND church_id = church_conversations.church_id
    )
  );

-- Allow church admins to read all messages in their church
CREATE POLICY "church admins read church messages" ON church_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid() AND church_id = church_messages.church_id
    )
  );
