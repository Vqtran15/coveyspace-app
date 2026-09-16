-- Migration 81: RPCs for group admins to link/unlink their group to a church
-- Run in Supabase SQL editor (project ktmlyzwpgvhrwfgyoeiq).

-- Link the calling user's group to a church.
-- Only a group admin can call this. The church must exist.
-- Setting church_id fires the on_group_church_linked trigger which auto-adds
-- all current members to that church's conversations.
CREATE OR REPLACE FUNCTION link_group_to_church(p_church_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_group_id uuid := current_community_group_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Only group admins can link to a church'; END IF;
  IF NOT EXISTS (SELECT 1 FROM churches WHERE id = p_church_id) THEN
    RAISE EXCEPTION 'Church not found';
  END IF;
  UPDATE community_groups SET church_id = p_church_id WHERE id = v_group_id;
END;
$$;

-- Remove the church link from the calling user's group.
-- Only a group admin can call this.
CREATE OR REPLACE FUNCTION unlink_group_from_church()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN RAISE EXCEPTION 'Only group admins can unlink from a church'; END IF;
  UPDATE community_groups SET church_id = NULL WHERE id = current_community_group_id();
END;
$$;
