-- Migration 18: RPC to delete a conversation
-- Cascades to messages, reactions, and conversation_members automatically.
-- Prevents deleting the main group conversation (identified by name, set by DB trigger on group creation).
-- Run in Supabase SQL Editor

create or replace function delete_conversation(conv_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare
  conv record;
begin
  if not is_conversation_member(conv_id) then
    raise exception 'Not a member of this conversation';
  end if;

  select * into conv from conversations where id = conv_id;

  -- Block deletion of the main group conversation (name set by DB trigger, never changes)
  if conv.name = 'Main Group Chat' then
    raise exception 'Cannot delete the main group conversation';
  end if;

  -- Deleting the conversation cascades to messages → reactions and conversation_members
  delete from conversations where id = conv_id;
end;
$$;
