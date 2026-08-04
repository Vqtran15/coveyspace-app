-- Migration 67: First/last name in profiles + PCO member sync
-- Run in Supabase SQL editor: https://app.supabase.com → SQL Editor (project ktmlyzwpgvhrwfgyoeiq)

-- ─── 1. Schema changes ────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Stores which PCO Group ID to add new Covey Space members to automatically.
ALTER TABLE planning_center_connections ADD COLUMN IF NOT EXISTS pco_sync_group_id TEXT;

-- ─── 2. Update handle_new_user trigger ───────────────────────────────────────
-- Now reads first_name and last_name from auth metadata and stores them.
-- display_name is auto-composed from first+last if not explicitly provided,
-- but stays independent so users can customize it separately in settings.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp_id     uuid;
  grp_name   text := trim(new.raw_user_meta_data->>'community_group_name');
  inv_code   text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  disp_name  text := trim(new.raw_user_meta_data->>'display_name');
  first_name text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  last_name  text := nullif(trim(new.raw_user_meta_data->>'last_name'),  '');
  usr_role   text := 'member';
  new_code   text;
BEGIN
  IF disp_name IS NULL OR disp_name = '' THEN RETURN new; END IF;

  IF inv_code IS NOT NULL AND inv_code <> '' THEN
    SELECT id INTO grp_id FROM community_groups WHERE invite_code = inv_code;
    IF grp_id IS NULL THEN
      RAISE EXCEPTION 'Invalid invite code. Please check with your group leader.';
    END IF;

  ELSIF grp_name IS NOT NULL AND grp_name <> '' THEN
    IF EXISTS (SELECT 1 FROM community_groups WHERE name = grp_name) THEN
      RAISE EXCEPTION 'A group with that name already exists. Use an invite code to join it.';
    END IF;
    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM community_groups WHERE invite_code = new_code);
    END LOOP;
    INSERT INTO community_groups (name, invite_code)
    VALUES (grp_name, new_code)
    RETURNING id INTO grp_id;
    usr_role := 'admin';

  ELSE
    RETURN new;
  END IF;

  INSERT INTO profiles (user_id, community_group_id, display_name, role, first_name, last_name)
  VALUES (new.id, grp_id, coalesce(nullif(disp_name, ''), 'Member'), usr_role, first_name, last_name);

  RETURN new;
END;
$$;

-- ─── 3. Update get_pco_connection to expose pco_sync_group_id ────────────────
-- Must drop first because the return type is changing (new pco_sync_group_id column).

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
  SELECT pco_organization_id, pco_organization_name, connected_at, pco_sync_group_id
  FROM planning_center_connections
  WHERE community_group_id = (
    SELECT community_group_id FROM profiles WHERE user_id = auth.uid()
  );
$$;

-- ─── 4. New RPC: set_pco_sync_group ──────────────────────────────────────────
-- Admin-only: saves the PCO Group ID to auto-add new Covey Space members to.
-- Pass NULL to disable sync.

CREATE OR REPLACE FUNCTION set_pco_sync_group(target_group_id TEXT)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE planning_center_connections
  SET pco_sync_group_id = target_group_id
  WHERE community_group_id = (
    SELECT community_group_id FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── 5. Webhook: profiles INSERT → sync-pco-member ───────────────────────────
-- In Supabase Dashboard → Database → Webhooks → Create new webhook:
--   Name:    on_profile_insert_pco
--   Table:   profiles
--   Events:  INSERT
--   URL:     https://ktmlyzwpgvhrwfgyoeiq.supabase.co/functions/v1/sync-pco-member
--   Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--            Content-Type: application/json
--
-- Deploy the function with:
--   supabase functions deploy sync-pco-member --no-verify-jwt
