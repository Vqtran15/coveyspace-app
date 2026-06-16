-- Migration 05: Decouple pages from date-driven ordering
-- Run this in your Supabase SQL Editor

-- Explicit ordering column, independent of week_date.
alter table meal_pages    add column if not exists position int;
alter table serving_pages add column if not exists position int;

-- Backfill position from the existing week_date order.
update meal_pages m
set position = sub.rn
from (select id, row_number() over (order by week_date) - 1 as rn from meal_pages) sub
where m.id = sub.id;

update serving_pages m
set position = sub.rn
from (select id, row_number() over (order by week_date) - 1 as rn from serving_pages) sub
where m.id = sub.id;

alter table meal_pages    alter column position set not null;
alter table serving_pages alter column position set not null;

-- week_date is now purely informational — it no longer drives ordering,
-- so it doesn't need to be unique.
alter table meal_pages    drop constraint if exists meal_pages_week_date_key;
alter table serving_pages drop constraint if exists serving_pages_week_date_key;
