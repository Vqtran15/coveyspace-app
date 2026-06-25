-- Migration 32: Add avatar_icon to profiles
alter table profiles add column if not exists avatar_icon text;
