-- Migration 47: Profile photo upload
-- Adds avatar_image_url to profiles and prayer_reactions so users can upload
-- a custom photo in addition to choosing an icon/color avatar.
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

alter table profiles
  add column if not exists avatar_image_url text;

alter table prayer_reactions
  add column if not exists avatar_image_url text;
