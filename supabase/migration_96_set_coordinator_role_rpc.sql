-- Migration 96: set_coordinator_role RPC
--
-- group_memberships has no UPDATE RLS policy, so direct client-side .update()
-- calls are silently blocked (0 rows affected, no error). This mirrors the pattern
-- used by set_member_role — a SECURITY DEFINER function that bypasses RLS.
--
-- Run in Supabase SQL Editor:

CREATE OR REPLACE FUNCTION set_coordinator_role(target_user_id uuid, new_coordinator_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp_id uuid := current_community_group_id();
BEGIN
  IF NOT is_group_admin() THEN
    RAISE EXCEPTION 'Only admins can set coordinator roles';
  END IF;

  IF LENGTH(TRIM(new_coordinator_role)) > 50 THEN
    RAISE EXCEPTION 'Title must be 50 characters or fewer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_memberships
    WHERE user_id = target_user_id AND community_group_id = grp_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of your group';
  END IF;

  UPDATE group_memberships
    SET coordinator_role = NULLIF(TRIM(new_coordinator_role), '')
  WHERE user_id = target_user_id AND community_group_id = grp_id;
END;
$$;
