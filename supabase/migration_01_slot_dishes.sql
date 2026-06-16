-- Migration 01: Pre-configured dish names per slot
-- Run this in your Supabase SQL Editor

-- Add dish names array to meal pages (index 0 = slot 1)
alter table meal_pages add column if not exists slot_dishes text[] default '{}';

-- Drop dish from signups (dish is now configured on the page, not by the signer)
alter table signups alter column dish drop not null;
alter table signups drop column if exists dish;
