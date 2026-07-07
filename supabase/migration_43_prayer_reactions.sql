-- Migration 43: Prayer Reactions
-- Run in Supabase SQL editor.
--
-- After running this migration:
--   1. Deploy the edge function:
--        supabase functions deploy send-prayer-reaction-push
--   2. In Supabase dashboard → Database → Webhooks, create a webhook:
--        Name:   on_prayer_reaction_insert
--        Table:  prayer_reactions
--        Events: INSERT
--        URL:    https://<project-ref>.supabase.co/functions/v1/send-prayer-reaction-push

create table if not exists prayer_reactions (
  id                      uuid primary key default gen_random_uuid(),
  prayer_request_id       uuid not null references prayer_requests(id) on delete cascade,
  prayer_request_owner_id uuid not null,
  community_group_id      uuid not null,
  user_id                 uuid not null,
  display_name            text,
  avatar_icon             text,
  avatar_color            text,
  created_at              timestamptz default now(),
  unique (prayer_request_id, user_id)
);

alter table prayer_reactions enable row level security;

-- Anyone in the same group can view reactions
create policy "Group members can view prayer reactions"
on prayer_reactions for select
using (
  exists (
    select 1 from profiles
    where profiles.user_id = auth.uid()
    and profiles.community_group_id = prayer_reactions.community_group_id
  )
);

-- Users can only insert their own reactions
create policy "Users can insert their own prayer reactions"
on prayer_reactions for insert
with check (auth.uid() = user_id);

-- Users can only delete their own reactions
create policy "Users can delete their own prayer reactions"
on prayer_reactions for delete
using (auth.uid() = user_id);
