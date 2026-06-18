-- Migration 16: RPC to create a named group chat with selected members
-- Run in Supabase SQL Editor

create or replace function create_group_chat(chat_name text, member_ids uuid[])
returns uuid language plpgsql security definer
set search_path = public
as $$
declare
  conv_id uuid;
  gid     uuid;
  mid     uuid;
begin
  gid := current_community_group_id();
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if trim(chat_name) = '' then raise exception 'Name is required'; end if;

  insert into conversations (community_group_id, type, name)
  values (gid, 'group', trim(chat_name))
  returning id into conv_id;

  -- Always add the creator
  insert into conversation_members (conversation_id, user_id)
  values (conv_id, auth.uid());

  -- Add each selected member (must be in the same community group)
  if member_ids is not null then
    foreach mid in array member_ids loop
      if mid <> auth.uid() and exists (
        select 1 from profiles
        where user_id = mid and community_group_id = gid
      ) then
        insert into conversation_members (conversation_id, user_id)
        values (conv_id, mid)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return conv_id;
end;
$$;
