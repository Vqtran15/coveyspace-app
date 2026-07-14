-- Migration 46: Add giving/donation URL to group_settings
-- Adds a home screen card that links to a church or organization's giving/tithing page.
-- Feature is disabled by default; admins enable it and set the URL in Admin Settings.
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

alter table group_settings
  add column if not exists giving_url     text,
  add column if not exists giving_enabled boolean not null default false;
