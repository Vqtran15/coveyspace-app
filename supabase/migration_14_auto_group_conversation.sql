-- Migration 14: Auto-create Main Group Chat when a new community group is created
-- Run in Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Trigger: create "Main Group Chat" whenever a new community group is inserted
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function create_default_group_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into conversations (community_group_id, type, name)
  values (new.id, 'group', 'Main Group Chat');
  return new;
end;
$$;

create trigger on_community_group_created
  after insert on community_groups
  for each row execute function create_default_group_conversation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill: create conversations for any existing groups that don't have one,
--    then add all their members.
-- ─────────────────────────────────────────────────────────────────────────────
insert into conversations (community_group_id, type, name)
select cg.id, 'group', 'Main Group Chat'
from community_groups cg
where not exists (
  select 1 from conversations c
  where c.community_group_id = cg.id and c.type = 'group'
);

insert into conversation_members (conversation_id, user_id)
select c.id, p.user_id
from conversations c
join profiles p on p.community_group_id = c.community_group_id
where c.type = 'group'
on conflict do nothing;
