-- Migration 13: Conversations + Direct Messages
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor
-- Run the entire script at once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. conversations table
-- ─────────────────────────────────────────────────────────────────────────────
create table conversations (
  id                 uuid primary key default gen_random_uuid(),
  community_group_id uuid not null references community_groups(id) on delete cascade,
  type               text not null check (type in ('group', 'direct')),
  name               text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. conversation_members table
-- ─────────────────────────────────────────────────────────────────────────────
create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  primary key (conversation_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add conversation_id to messages
-- ─────────────────────────────────────────────────────────────────────────────
alter table messages add column conversation_id uuid references conversations(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Data migration — create a default group conversation per community_group,
--    add all existing members, and backfill conversation_id on existing messages.
--    Run BEFORE updating RLS so users don't lose message access mid-migration.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  grp    record;
  conv_id uuid;
begin
  for grp in select id from community_groups loop
    insert into conversations (community_group_id, type, name, updated_at)
    values (
      grp.id, 'group', 'Main Group Chat',
      coalesce((select max(created_at) from messages where community_group_id = grp.id), now())
    )
    returning id into conv_id;

    -- Add every current member to the conversation
    insert into conversation_members (conversation_id, user_id)
    select conv_id, p.user_id
    from profiles p
    where p.community_group_id = grp.id;

    -- Backfill existing messages
    update messages
    set conversation_id = conv_id
    where community_group_id = grp.id
      and conversation_id is null;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper: check conversation membership without going through RLS.
--    Using security definer breaks the circular reference that would otherwise
--    occur between the conversations and conversation_members RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function is_conversation_member(conv_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members
    where conversation_id = conv_id and user_id = auth.uid()
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS on conversations
-- ─────────────────────────────────────────────────────────────────────────────
alter table conversations enable row level security;

create policy "select own conversations" on conversations
  for select using (
    community_group_id = current_community_group_id()
    and is_conversation_member(id)
  );

create policy "insert conversations in own group" on conversations
  for insert with check (community_group_id = current_community_group_id());

create policy "update own conversations" on conversations
  for update using (
    community_group_id = current_community_group_id()
    and is_conversation_member(id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS on conversation_members
-- ─────────────────────────────────────────────────────────────────────────────
alter table conversation_members enable row level security;

create policy "view members of own conversations" on conversation_members
  for select using (
    is_conversation_member(conversation_id)
  );

create policy "join conversations in own group" on conversation_members
  for insert with check (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and c.community_group_id = current_community_group_id()
    )
  );

create policy "leave own conversations" on conversation_members
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Update messages RLS to use conversation membership
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "group members" on messages;

create policy "conversation members" on messages
  for all using (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trigger: bump conversations.updated_at whenever a message is inserted
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function touch_conversation()
returns trigger language plpgsql security definer as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_insert
  after insert on messages
  for each row execute function touch_conversation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Trigger: auto-add new profiles to all existing group conversations
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function add_member_to_group_conversations()
returns trigger language plpgsql security definer as $$
begin
  insert into conversation_members (conversation_id, user_id)
  select id, new.user_id
  from conversations
  where community_group_id = new.community_group_id
    and type = 'group'
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_profile_insert
  after insert on profiles
  for each row execute function add_member_to_group_conversations();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. find_or_create_dm RPC — finds existing DM or creates one atomically
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function find_or_create_dm(other_user_id uuid)
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  conv_id uuid;
  gid     uuid;
begin
  gid := current_community_group_id();

  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if auth.uid() = other_user_id then raise exception 'Cannot DM yourself'; end if;

  -- Validate other user is in the same group
  if not exists (
    select 1 from profiles where user_id = other_user_id and community_group_id = gid
  ) then
    raise exception 'User not in your group';
  end if;

  -- Look for an existing 1-on-1 direct conversation
  select c.id into conv_id
  from conversations c
  where c.type = 'direct'
    and c.community_group_id = gid
    and exists (select 1 from conversation_members where conversation_id = c.id and user_id = auth.uid())
    and exists (select 1 from conversation_members where conversation_id = c.id and user_id = other_user_id)
    and (select count(*) from conversation_members where conversation_id = c.id) = 2
  limit 1;

  if conv_id is not null then return conv_id; end if;

  -- Create new DM
  insert into conversations (community_group_id, type)
  values (gid, 'direct')
  returning id into conv_id;

  insert into conversation_members (conversation_id, user_id) values (conv_id, auth.uid());
  insert into conversation_members (conversation_id, user_id) values (conv_id, other_user_id);

  return conv_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Realtime for new tables
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_members;
