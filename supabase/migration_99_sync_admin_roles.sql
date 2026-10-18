-- Migration 99: Backfill group_memberships.role for admins promoted pre-migration 80
--
-- Before migration_80, set_member_role only updated profiles.role and never touched
-- group_memberships.role. Any user promoted via that old path has:
--   profiles.role = 'admin'
--   group_memberships.role = 'member'  ← stale
--
-- SettingsPage's Leadership card reads role from group_memberships (authoritative
-- per-group source). AdminPage reads from profiles (denormalized cache). This mismatch
-- causes an admin to appear as "Group Leader" in Group Settings but be missing from
-- the Leadership card.
--
-- Fix: for each user whose active group matches a group_memberships row, sync the
-- role upward (member → admin only — never demote) where profiles says admin.
-- Safe to run multiple times (idempotent).
--
-- Run in Supabase SQL Editor:

UPDATE group_memberships gm
SET role = 'admin'
FROM profiles p
WHERE gm.user_id           = p.user_id
  AND gm.community_group_id = p.community_group_id
  AND p.role                = 'admin'
  AND gm.role               = 'member';
