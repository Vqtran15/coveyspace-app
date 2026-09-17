-- migration_88: Harden check_pco_members
--
-- Two fixes:
-- 1. Require caller to have a church_roles row (security: any authed user
--    could previously call this and probe whether any email is in a group).
-- 2. Accept an optional target_group_id so the "Member ✓" check is evaluated
--    against the group the admin is actually importing into, not their own
--    active group (which may be different when a church has multiple groups).
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

CREATE OR REPLACE FUNCTION check_pco_members(
  emails         text[],
  target_group_id uuid DEFAULT NULL
)
RETURNS TABLE (email text, in_group boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Church admin only
  IF NOT EXISTS (SELECT 1 FROM church_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Use the provided target group; fall back to the caller's active group
  v_group_id := COALESCE(
    target_group_id,
    (SELECT community_group_id FROM profiles WHERE user_id = auth.uid())
  );

  RETURN QUERY
  SELECT e.email,
    (p.user_id IS NOT NULL) AS in_group
  FROM unnest(emails) e(email)
  LEFT JOIN auth.users au ON lower(au.email) = lower(e.email)
  LEFT JOIN profiles p
    ON p.user_id = au.id
   AND p.community_group_id = v_group_id;
END;
$$;
