-- Migration 12: Delete account RPC
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- Allows an authenticated user to permanently delete their own account.
-- SECURITY DEFINER is required to access auth.users (restricted schema).
-- The function validates identity via auth.uid() so it can only delete the caller.

create or replace function delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete user-scoped data first to avoid FK constraint errors.
  -- Tables scoped to community_groups (meal_pages, signups, etc.) are left intact.
  delete from reactions    where user_id   = uid;
  delete from messages     where user_id   = uid;
  delete from birthdays    where user_id   = uid;
  delete from profiles     where user_id   = uid;

  -- Finally delete the auth account — this cascades anything we missed.
  delete from auth.users where id = uid;
end;
$$;
