-- Migration 02: Store the rotation cycle length
-- Run this in your Supabase SQL Editor

alter table app_settings add column if not exists cycle_length int;
