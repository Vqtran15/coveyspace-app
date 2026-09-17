-- migration_87: Pin SET search_path = public on all SECURITY DEFINER functions
-- that were missing it. Prevents search_path injection attacks where a
-- shadowed table (e.g. a user-created schema with a 'profiles' table) could
-- bypass logic inside these functions.
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- S1: leave_group() — defined in migration_71.
-- Missing SET search_path caused the admin-count guard and DELETE operations
-- to be vulnerable to a shadowed 'profiles' or 'group_memberships' table.
ALTER FUNCTION leave_group() SET search_path = public;

-- S2: is_church_admin(uuid) — defined in migration_70.
-- Used inside RLS policies; a shadowed 'church_roles' table could bypass
-- church-admin checks entirely.
ALTER FUNCTION is_church_admin(uuid) SET search_path = public;

-- S3: get_pco_connection() — defined in migration_78.
ALTER FUNCTION get_pco_connection() SET search_path = public;

-- S4: set_pco_sync_group(text) — defined in migration_78.
ALTER FUNCTION set_pco_sync_group(text) SET search_path = public;
