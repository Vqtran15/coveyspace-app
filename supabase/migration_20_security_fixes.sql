-- Migration 20: Security fixes — H1, H3, H4
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- H1: messages — split FOR ALL into per-operation policies.
--     DELETE is now restricted to the message author only.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "conversation members" on messages;

create policy "messages select" on messages
  for select using (is_conversation_member(conversation_id));

create policy "messages insert" on messages
  for insert with check (
    is_conversation_member(conversation_id)
    and user_id = auth.uid()
  );

create policy "messages delete" on messages
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- H3: conversation_members — require NEW.user_id = auth.uid() on insert.
--     Prevents any member from adding themselves to a DM they're not part of.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "join conversations in own group" on conversation_members;

create policy "join conversations in own group" on conversation_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and c.community_group_id = current_community_group_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- H4: community_groups — drop the open update policy and replace with a
--     SECURITY DEFINER RPC that only allows updating the notes column.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "members can update group notes" on community_groups;

create or replace function update_group_notes(p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update community_groups set notes = p_notes where id = current_community_group_id();
end;
$$;
