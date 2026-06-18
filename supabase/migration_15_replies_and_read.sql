-- Migration 15: Reply-to messages + per-conversation read tracking
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reply-to support on messages
-- ─────────────────────────────────────────────────────────────────────────────
alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Per-conversation read tracking on conversation_members
-- ─────────────────────────────────────────────────────────────────────────────
alter table conversation_members add column if not exists last_read_at timestamptz;

-- Initialize to now() for all existing memberships so nothing shows as unread on first load
update conversation_members set last_read_at = now() where last_read_at is null;

-- Allow users to update their own membership row (needed for last_read_at)
create policy "update own membership" on conversation_members
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());
