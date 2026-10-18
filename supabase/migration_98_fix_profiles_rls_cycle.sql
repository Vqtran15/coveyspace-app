-- Migration 98: Fix RLS cycle introduced by migration_97
--
-- Problem:
--   migration_97 added a profiles SELECT policy that reads group_memberships.
--   The group_memberships admin policy (migration_71) reads profiles in its EXISTS check.
--   Result: profiles → group_memberships → profiles → infinite recursion.
--
-- Fix:
--   Drop the offending policy, introduce a SECURITY DEFINER helper that reads
--   group_memberships without triggering its RLS, then recreate the policy
--   using the helper. This mirrors the fix in migration_92 for the church-admin cycle.
--
-- Run in Supabase SQL Editor:

-- Step 1: drop the cyclic policy from migration_97
DROP POLICY IF EXISTS "view co-members profiles" ON profiles;

-- Step 2: helper function — SECURITY DEFINER bypasses RLS on both tables,
--         breaking the cycle
CREATE OR REPLACE FUNCTION is_co_member(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE user_id          = target_user_id
      AND community_group_id = current_community_group_id()
  )
$$;

-- Step 3: recreate the policy using the cycle-safe helper
CREATE POLICY "view co-members profiles" ON profiles
  FOR SELECT USING (is_co_member(user_id));
