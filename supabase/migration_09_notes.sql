-- Migration 09: Add personal notes to user profiles
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

alter table profiles add column if not exists notes text default '';
