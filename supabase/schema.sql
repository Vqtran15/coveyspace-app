-- Meal Rotation Schema
-- Run this in your Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- Meal pages (one per week)
create table meal_pages (
  id          uuid    default gen_random_uuid() primary key,
  title       text    not null,
  week_date   date    not null unique,
  slot_count  int     not null default 10 check (slot_count between 1 and 30),
  created_at  timestamptz default now()
);

-- Individual sign-ups per slot
create table signups (
  id              uuid    default gen_random_uuid() primary key,
  meal_page_id    uuid    references meal_pages(id) on delete cascade not null,
  slot_number     int     not null,
  name            text    not null,
  dish            text    not null,
  dietary_tags    text[]  default '{}',
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (meal_page_id, slot_number)
);

-- Singleton app settings row
create table app_settings (
  id                  int     primary key default 1 check (id = 1),
  rotation_paused     boolean default false,
  current_page_id     uuid    references meal_pages(id) on delete set null
);

-- Seed the settings row
insert into app_settings (id) values (1);

-- Row Level Security: allow full public access (no auth required)
alter table meal_pages    enable row level security;
alter table signups       enable row level security;
alter table app_settings  enable row level security;

create policy "public read/write" on meal_pages    for all using (true) with check (true);
create policy "public read/write" on signups       for all using (true) with check (true);
create policy "public read/write" on app_settings  for all using (true) with check (true);

-- Enable realtime for live sign-up updates
alter publication supabase_realtime add table signups;
