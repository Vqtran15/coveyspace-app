-- Migration 90: RPC for church admins to rotate (reset) their church's join code.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

CREATE OR REPLACE FUNCTION rotate_church_join_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_church_id uuid;
  new_code    text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT church_id INTO v_church_id FROM church_roles WHERE user_id = auth.uid() LIMIT 1;
  IF v_church_id IS NULL THEN RAISE EXCEPTION 'Not a church admin'; END IF;

  LOOP
    new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM churches WHERE join_code = new_code);
  END LOOP;

  UPDATE churches SET join_code = new_code WHERE id = v_church_id;
  RETURN new_code;
END;
$$;
