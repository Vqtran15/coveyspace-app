-- migration_92_fix_group_memberships_rls_cycle
--
-- Problem: migration_91 introduced a circular RLS dependency that breaks all
-- data loading for church admins.
--
-- The cycle:
--   1. Reading `community_groups` triggers the "view joined groups" policy
--      (migration_72), which reads `group_memberships`.
--   2. Reading `group_memberships` triggers migration_91's policy, which
--      JOINs `community_groups` — triggering step 1 again.
--   3. Postgres hits its stack depth limit and the query fails with an error.
--
-- Since `db.profiles.fetch` embeds `community_groups(...)`, this causes the
-- profile fetch to return null for church admins, making groupId null and
-- breaking conversations, prayer, isAdmin, and avatar display.
--
-- Fix: Replace the direct JOIN in the policy with a SECURITY DEFINER helper
-- function. SECURITY DEFINER bypasses RLS on community_groups inside the
-- function body, so the cycle is broken.

-- Step 1: Drop the broken policy
DROP POLICY IF EXISTS "church admins see memberships in their church" ON group_memberships;

-- Step 2: SECURITY DEFINER helper that checks church admin scope without RLS cycle
CREATE OR REPLACE FUNCTION is_church_admin_for_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM church_roles cr
      JOIN community_groups cg ON cg.church_id = cr.church_id
     WHERE cr.user_id = auth.uid()
       AND cg.id = p_group_id
  )
$$;

-- Step 3: Recreate the policy using the bypass function
CREATE POLICY "church admins see memberships in their church" ON group_memberships
  FOR SELECT USING (
    is_church_admin_for_group(community_group_id)
  );
