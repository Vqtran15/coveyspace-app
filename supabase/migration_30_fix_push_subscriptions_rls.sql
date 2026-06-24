-- Ensure the push_subscriptions table has RLS enabled and the correct policy.
-- Migration 26 may have been applied without the policy if the table was
-- created outside of the migration runner.

alter table push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on push_subscriptions;

create policy "users manage own push subscriptions"
  on push_subscriptions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
