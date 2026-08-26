-- Migration 78: Scope PCO connection lookup to church, not just active group
-- Fixes: church admin switching groups loses visibility of the PCO connection.
-- The planning_center_connections row is stored under whichever group the admin
-- was viewing when they connected — but the connection belongs to the whole church.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- ─── 1. get_pco_connection — look up by church ─────────────────────────────────
-- Drop first because the return type shape must match exactly.
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
  WHERE cg.church_id IS NOT NULL
    AND cg.church_id = (
      SELECT cg2.church_id
      FROM profiles p
      JOIN community_groups cg2 ON cg2.id = p.community_group_id
      WHERE p.user_id = auth.uid()
    )
  LIMIT 1;
$$;

-- ─── 2. set_pco_sync_group — update by church (church admin only) ──────────────
CREATE OR REPLACE FUNCTION set_pco_sync_group(target_group_id TEXT)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE planning_center_connections
  SET pco_sync_group_id = target_group_id
  WHERE community_group_id IN (
    SELECT cg.id
    FROM community_groups cg
    INNER JOIN church_roles cr ON cr.church_id = cg.church_id AND cr.user_id = auth.uid()
  );
$$;
