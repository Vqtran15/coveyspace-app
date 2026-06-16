-- Migration 03: Serving tab tables
-- Run this in your Supabase SQL Editor

create table serving_pages (
  id          uuid    default gen_random_uuid() primary key,
  title       text    not null,
  week_date   date    not null unique,
  slot_count  int     not null default 10 check (slot_count between 1 and 30),
  slot_dishes text[]  default '{}',
  created_at  timestamptz default now()
);

-- meal_page_id column name is intentionally reused so MealPage.jsx works unchanged
create table serving_signups (
  id              uuid    default gen_random_uuid() primary key,
  meal_page_id    uuid    references serving_pages(id) on delete cascade not null,
  slot_number     int     not null,
  name            text    not null,
  dietary_tags    text[]  default '{}',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (meal_page_id, slot_number)
);

create table serving_settings (
  id                int     primary key default 1 check (id = 1),
  rotation_paused   boolean default false,
  current_page_id   uuid    references serving_pages(id) on delete set null,
  cycle_length      int
);

insert into serving_settings (id) values (1);

alter table serving_pages    enable row level security;
alter table serving_signups  enable row level security;
alter table serving_settings enable row level security;

create policy "public read/write" on serving_pages    for all using (true) with check (true);
create policy "public read/write" on serving_signups  for all using (true) with check (true);
create policy "public read/write" on serving_settings for all using (true) with check (true);

alter publication supabase_realtime add table serving_signups;
