-- Migration 11: Message reactions + replica identity for DELETE events
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- 1. Reactions table
create table reactions (
  id                 uuid primary key default gen_random_uuid(),
  message_id         uuid not null references messages(id) on delete cascade,
  community_group_id uuid not null references community_groups(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  emoji              text not null,
  created_at         timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- 2. RLS: group members can read and write their group's reactions
alter table reactions enable row level security;

create policy "group members" on reactions
  for all using (community_group_id = current_community_group_id())
  with check (community_group_id = current_community_group_id());

-- 3. Realtime for live reaction updates
alter publication supabase_realtime add table reactions;

-- 4. Replica identity full so DELETE events include the full old row
--    (needed for realtime DELETE to carry message_id / reaction id)
alter table messages  replica identity full;
alter table reactions replica identity full;
