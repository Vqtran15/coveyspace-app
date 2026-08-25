-- migration_73_church_admin_rls
--
-- Problem: community_groups RLS only lets users see groups they are members of.
-- A church admin composing a broadcast needs to see ALL groups in their church
-- (to populate the group-targeting picker), even groups they haven't personally
-- joined. Without this policy, the fetch returns only 1 group and the "Select
-- groups" targeting UI never appears.

CREATE POLICY "church admins view all groups in their church" ON community_groups
  FOR SELECT TO authenticated USING (
    church_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM church_roles
      WHERE user_id = auth.uid()
        AND church_id = community_groups.church_id
    )
  );
