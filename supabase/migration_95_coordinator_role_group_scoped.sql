-- Migration 95: Move coordinator_role to group_memberships (group-scoped)
--
-- Migration 94 added coordinator_role to profiles (user-scoped, shared across groups).
-- This migration moves it to group_memberships so each group can have its own title
-- per member (e.g. "Worship Leader" in one group, nothing in another).
--
-- Run in Supabase SQL editor:

ALTER TABLE group_memberships ADD COLUMN IF NOT EXISTS coordinator_role text;

-- Drop the now-unused column from profiles (safe — no data was written to prod yet)
ALTER TABLE profiles DROP COLUMN IF EXISTS coordinator_role;
