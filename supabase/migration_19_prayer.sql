-- Migration 19: Prayer Requests
-- prayer_friends: people the user wants to pray for (private per user)
-- prayer_requests: dated prayer entries per friend (private per user)
-- Run in Supabase SQL Editor

create table prayer_friends (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
alter table prayer_friends enable row level security;
create policy "own prayer friends" on prayer_friends
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table prayer_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  friend_id  uuid not null references prayer_friends(id) on delete cascade,
  date       date not null default current_date,
  request    text not null,
  created_at timestamptz not null default now()
);
alter table prayer_requests enable row level security;
create policy "own prayer requests" on prayer_requests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
