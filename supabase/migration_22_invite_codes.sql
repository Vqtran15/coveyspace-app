-- Migration 22: Invite codes for group joining
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add invite_code column and populate existing groups
-- ─────────────────────────────────────────────────────────────────────────────
alter table community_groups add column invite_code text unique;

-- Generate a 6-char uppercase hex code from each group's UUID
update community_groups
set invite_code = upper(substring(replace(id::text, '-', ''), 1, 6));

alter table community_groups
  alter column invite_code set not null,
  add constraint invite_code_length check (length(invite_code) = 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the public group name enumeration policy (fixes L2).
--    AuthPage no longer shows a dropdown — invite code replaces it.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "public read group names" on community_groups;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update handle_new_user() to validate invite codes.
--    - invite_code in metadata → join existing group (validated)
--    - community_group_name in metadata → create new group (unique name required)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  grp_id    uuid;
  grp_name  text := trim(new.raw_user_meta_data->>'community_group_name');
  inv_code  text := upper(trim(new.raw_user_meta_data->>'invite_code'));
  disp_name text := trim(new.raw_user_meta_data->>'display_name');
  new_code  text;
begin
  if disp_name is null or disp_name = '' then return new; end if;

  if inv_code is not null and inv_code <> '' then
    -- Joining an existing group via invite code
    select id into grp_id from community_groups where invite_code = inv_code;
    if grp_id is null then
      raise exception 'Invalid invite code. Please check with your group leader.';
    end if;

  elsif grp_name is not null and grp_name <> '' then
    -- Creating a new group — name must be unique
    if exists (select 1 from community_groups where name = grp_name) then
      raise exception 'A group with that name already exists. Use an invite code to join it.';
    end if;

    -- Generate a unique 6-char invite code
    loop
      new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      exit when not exists (select 1 from community_groups where invite_code = new_code);
    end loop;

    insert into community_groups (name, invite_code)
    values (grp_name, new_code)
    returning id into grp_id;

  else
    return new;
  end if;

  insert into profiles (user_id, community_group_id, display_name)
  values (new.id, grp_id, coalesce(nullif(disp_name, ''), 'Member'));

  return new;
end;
$$;
