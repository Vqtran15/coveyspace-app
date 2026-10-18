-- Migration 94: Add coordinator_role to profiles
--
-- Adds a free-text coordinator title (e.g. "Worship Leader", "Small Group Host")
-- visible to all group members via the Leadership card in SettingsPage.
-- Admins set/clear this field per-member in AdminPage > member action sheet.
--
-- Run in Supabase SQL editor:

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coordinator_role text;
