-- Migration 37: Drop legacy open RLS policies that allow cross-group data reads
-- Root cause: migration_03 / migration_04 / schema.sql created "public read/write"
-- (or per-operation equivalents) policies with using(true). Migration_07 added
-- group-scoped "group members" policies but never dropped the open ones.
-- Postgres OR's permissive policies, so ANY matching policy grants access —
-- meaning every user could read every group's data. Dropping the open policies
-- leaves only the group-scoped "group members" policy on each table, which is
-- what was always intended.
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- ── meal_pages (schema.sql created "public read/write") ──────────────────────
drop policy if exists "public read/write" on meal_pages;

-- ── signups (schema.sql created "public read/write") ─────────────────────────
drop policy if exists "public read/write" on signups;

-- ── serving_pages (migration_03 created "public read/write") ─────────────────
drop policy if exists "public read/write" on serving_pages;

-- ── serving_signups (migration_03 created "public read/write") ───────────────
drop policy if exists "public read/write" on serving_signups;

-- ── birthdays (migration_04 created four per-operation open policies) ─────────
drop policy if exists "public read birthdays"   on birthdays;
drop policy if exists "public insert birthdays" on birthdays;
drop policy if exists "public update birthdays" on birthdays;
drop policy if exists "public delete birthdays" on birthdays;

-- After this migration the "group members" policy added by migration_07 is the
-- only policy on each of these tables, correctly scoping every operation to the
-- authenticated user's community_group_id.
