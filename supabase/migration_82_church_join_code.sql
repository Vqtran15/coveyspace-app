-- Migration 82: Add join_code to churches so group admins must have a
-- church-issued code to link their group. Prevents any group admin from
-- linking to an arbitrary church without the church's consent.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- 1. Add join_code column
ALTER TABLE churches ADD COLUMN IF NOT EXISTS join_code text UNIQUE;

-- 2. Backfill existing churches with generated codes
DO $$
DECLARE
  rec   RECORD;
  code  text;
BEGIN
  FOR rec IN SELECT id FROM churches WHERE join_code IS NULL LOOP
    LOOP
      code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM churches WHERE join_code = code);
    END LOOP;
    UPDATE churches SET join_code = code WHERE id = rec.id;
  END LOOP;
END;
$$;

ALTER TABLE churches ALTER COLUMN join_code SET NOT NULL;

-- 3. Auto-generate join_code on INSERT
CREATE OR REPLACE FUNCTION set_church_join_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE new_code text;
BEGIN
  IF NEW.join_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM churches WHERE join_code = new_code);
  END LOOP;
  NEW.join_code := new_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_church_insert_set_code ON churches;
CREATE TRIGGER on_church_insert_set_code
  BEFORE INSERT ON churches
  FOR EACH ROW EXECUTE FUNCTION set_church_join_code();

-- 4. Replace link_group_to_church: now takes a join code, not a church UUID.
--    Group admins never need to know the church UUID — the code resolves it.
DROP FUNCTION IF EXISTS link_group_to_church(uuid);

CREATE OR REPLACE FUNCTION link_group_to_church(p_join_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_church churches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Only group admins can link to a church'; END IF;

  SELECT * INTO v_church FROM churches WHERE join_code = upper(trim(p_join_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;

  UPDATE community_groups SET church_id = v_church.id WHERE id = current_community_group_id();

  RETURN json_build_object('church_id', v_church.id, 'church_name', v_church.name);
END;
$$;

-- 5. RPC for church admins to fetch their church's join code
CREATE OR REPLACE FUNCTION get_church_join_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_church_id uuid;
  v_code      text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT church_id INTO v_church_id FROM church_roles WHERE user_id = auth.uid() LIMIT 1;
  IF v_church_id IS NULL THEN RAISE EXCEPTION 'Not a church admin'; END IF;
  SELECT join_code INTO v_code FROM churches WHERE id = v_church_id;
  RETURN v_code;
END;
$$;
