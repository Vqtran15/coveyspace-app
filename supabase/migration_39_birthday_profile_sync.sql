-- migration_39_birthday_profile_sync.sql
-- 1. Add birthday to profiles
-- 2. Add profile_user_id to birthdays for sync tracking
-- 3. Add feature toggle columns to group_settings (app already reads these; now persisted)
-- 4. DB trigger: profiles.birthday → birthdays table

-- ── 1. Birthday on profiles ──────────────────────────────────────────────────
alter table profiles add column if not exists birthday date;

-- ── 2. Link birthdays rows back to the profile that owns them ────────────────
alter table birthdays
  add column if not exists profile_user_id uuid references auth.users(id) on delete set null;

alter table birthdays
  add constraint birthdays_profile_user_id_unique unique (profile_user_id);

-- ── 3. Feature toggle columns on group_settings ──────────────────────────────
alter table group_settings
  add column if not exists meals_enabled     boolean not null default true,
  add column if not exists services_enabled  boolean not null default true,
  add column if not exists chat_enabled      boolean not null default true,
  add column if not exists prayer_enabled    boolean not null default true,
  add column if not exists birthdays_enabled boolean not null default true,
  add column if not exists guide_enabled     boolean not null default true;

-- ── 4. Trigger: sync profiles.birthday → birthdays ───────────────────────────
create or replace function sync_profile_birthday()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.birthday is not null and new.display_name is not null then
    insert into birthdays (name, birthday, community_group_id, profile_user_id)
    values (new.display_name, new.birthday, new.community_group_id, new.user_id)
    on conflict (profile_user_id)
    do update set
      birthday = excluded.birthday,
      name     = excluded.name;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_birthday_on_profile_update on profiles;
create trigger sync_birthday_on_profile_update
  after insert or update of birthday, display_name on profiles
  for each row execute function sync_profile_birthday();
