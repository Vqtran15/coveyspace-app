-- Migration 79: Fix get_pco_connection to use church_roles instead of active group
-- Bug: when admin switches to a group with church_id = NULL, the migration_78 query
--      returns NULL from the subquery, so `church_id = NULL` never matches any row.
-- Fix: join planning_center_connections → community_groups → church_roles directly,
--      so the lookup is always based on which churches the caller is an admin of —
--      independent of which group they currently have active.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

DROP FUNCTION IF EXISTS get_pco_connection();

CREATE OR REPLACE FUNCTION get_pco_connection()
RETURNS TABLE (
  pco_organization_id   TEXT,
  pco_organization_name TEXT,
  connected_at          TIMESTAMPTZ,
  pco_sync_group_id     TEXT
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT pcc.pco_organization_id, pcc.pco_organization_name, pcc.connected_at, pcc.pco_sync_group_id
  FROM planning_center_connections pcc
  INNER JOIN community_groups cg ON cg.id = pcc.community_group_id
  INNER JOIN church_roles cr ON cr.church_id = cg.church_id AND cr.user_id = auth.uid()
  LIMIT 1;
$$;
