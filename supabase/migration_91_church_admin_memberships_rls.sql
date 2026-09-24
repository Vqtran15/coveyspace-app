-- migration_91_church_admin_memberships_rls
--
-- Problem: Church Analytics needs admin count and last-joined date per group,
-- both sourced from group_memberships. The existing RLS policies only let
-- a church admin see memberships in their own active group — not across all
-- groups in their church.
--
-- Fix: Add a SELECT policy mirroring the pattern in migration_73 (which
-- opened community_groups to church admins). Church admins can now read
-- group_memberships rows for any group that belongs to their church.

CREATE POLICY "church admins see memberships in their church" ON group_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM church_roles cr
        JOIN community_groups cg ON cg.church_id = cr.church_id
       WHERE cr.user_id = auth.uid()
         AND cg.id = group_memberships.community_group_id
    )
  );
