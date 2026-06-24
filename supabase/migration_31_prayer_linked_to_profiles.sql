-- Migration 31: Link prayer requests directly to profiles
-- Removes the manual prayer_friends system; group members are now derived
-- from the profiles table so only real app users appear in the prayer tab.

drop table if exists prayer_requests;
drop table if exists prayer_friends;

create table prayer_requests (
  id                 uuid primary key default gen_random_uuid(),
  community_group_id uuid not null default current_community_group_id() references community_groups(id),
  member_user_id     uuid not null references auth.users(id) on delete cascade,
  added_by           text not null default '',
  date               date not null default current_date,
  request            text not null,
  created_at         timestamptz not null default now()
);

alter table prayer_requests enable row level security;

create policy "group members" on prayer_requests
  for all
  using  (community_group_id = current_community_group_id())
  with check (community_group_id = current_community_group_id());
