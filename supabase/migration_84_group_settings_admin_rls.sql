-- Migration 84: Restrict group_settings writes to admins only
--
-- Bug (Security H1): The original "group members" policy was FOR ALL with no
-- role check, meaning any authenticated group member could overwrite settings
-- (guide_url, giving_url, feature flags) via a direct API call, bypassing the
-- client-side admin guard.
--
-- Fix: Drop the catch-all policy and replace with:
--   - SELECT open to all group members
--   - INSERT/UPDATE/DELETE restricted to group admins via is_group_admin()
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

DROP POLICY IF EXISTS "group members" ON group_settings;

CREATE POLICY "group members read settings" ON group_settings
  FOR SELECT
  USING (group_id = current_community_group_id());

CREATE POLICY "group admins write settings" ON group_settings
  FOR ALL
  USING  (group_id = current_community_group_id() AND is_group_admin())
  WITH CHECK (group_id = current_community_group_id() AND is_group_admin());
