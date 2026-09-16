-- Migration 83: Replace church_id UUID in signup metadata with church_join_code.
-- Previously handle_new_user accepted a raw church_id UUID — any UUID discoverable
-- via the public churches table could be passed, linking a group to any church.
-- Now it accepts church_join_code (text), validates it, and resolves to the church UUID.
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  grp_id          uuid;
  grp_name        text := trim(new.raw_user_meta_data->>'community_group_name');
  inv_code        text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  disp_name       text := trim(new.raw_user_meta_data->>'display_name');
  first_name      text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  last_name       text := nullif(trim(new.raw_user_meta_data->>'last_name'),  '');
  church_join_code text := upper(trim(nullif(new.raw_user_meta_data->>'church_join_code', '')));
  resolved_church_id uuid := NULL;
  usr_role        text := 'member';
  new_code        text;
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

    -- Resolve church join code if provided
    IF church_join_code IS NOT NULL THEN
      SELECT id INTO resolved_church_id FROM churches WHERE join_code = church_join_code;
      -- Silently ignore invalid codes rather than blocking signup;
      -- the client validates the code before submitting.
    END IF;

    LOOP
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM community_groups WHERE invite_code = new_code);
    END LOOP;
    INSERT INTO community_groups (name, invite_code, church_id)
    VALUES (grp_name, new_code, resolved_church_id)
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
