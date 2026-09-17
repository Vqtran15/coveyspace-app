-- Migration 85: Protect churches.join_code from unauthenticated enumeration
--
-- Bug (Security M1): Migration 80 added "public read churches" with USING(true)
-- when churches only had {id, name, created_at}. Migration 82 later added
-- join_code, which that open policy now exposes to unauthenticated API calls.
-- Anyone can enumerate all church join codes in one request.
--
-- Fix:
--   1. Add a SECURITY DEFINER RPC that resolves ONE code → {id, name} without
--      ever returning the code itself. Callable by anon.
--   2. Revoke direct SELECT on churches from anon, forcing unauthenticated
--      clients through the RPC.
--   3. Authenticated users (logged-in app users) retain SELECT for the
--      CreateGroupFlow church picker (id, name columns only — join_code is
--      never selected in the client queries).
--
-- Client change: db.js verifyJoinCode is updated to call this RPC.
--
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- 1. SECURITY DEFINER RPC: resolve a join code → {id, name}, or null if invalid.
--    Runs as the function owner (bypasses RLS), so it can read churches even
--    when called by anon. Returns only id+name — never echoes the code back.
CREATE OR REPLACE FUNCTION verify_church_join_code(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id   uuid;
  v_name text;
BEGIN
  SELECT id, name INTO v_id, v_name
  FROM churches
  WHERE join_code = upper(trim(p_code));

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN json_build_object('id', v_id, 'name', v_name);
END;
$$;

-- Allow anon and authenticated roles to call the RPC
GRANT EXECUTE ON FUNCTION verify_church_join_code(text) TO anon;
GRANT EXECUTE ON FUNCTION verify_church_join_code(text) TO authenticated;

-- 2. Drop the fully-open SELECT policy
DROP POLICY IF EXISTS "public read churches" ON churches;

-- 3. Restrict direct SELECT to authenticated users only (logged-in).
--    Anon users must use verify_church_join_code() RPC instead.
CREATE POLICY "authenticated read churches" ON churches
  FOR SELECT USING (auth.role() = 'authenticated');
