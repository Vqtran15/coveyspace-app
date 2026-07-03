-- Migration 42: Add guide_type and guide_content to group_settings; add guide file storage
-- Supports URL links, uploaded files (PDF/Word), and inline notes for the Community Guide.
-- Run in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns on group_settings
-- ─────────────────────────────────────────────────────────────────────────────
alter table group_settings
  add column if not exists guide_type    text check (guide_type in ('url', 'file', 'notes')),
  add column if not exists guide_content text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage bucket for uploaded guide files (PDF, Word docs)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('guide-files', 'guide-files', true)
on conflict (id) do nothing;

-- Any authenticated user can read guide files
create policy "guide files authenticated read"
on storage.objects for select
to authenticated
using (bucket_id = 'guide-files');

-- Group members can upload a guide file into their group's folder
create policy "guide files group insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'guide-files'
  and (storage.foldername(name))[1] = current_community_group_id()::text
);

-- Group members can replace (update) their group's guide file
create policy "guide files group update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'guide-files'
  and (storage.foldername(name))[1] = current_community_group_id()::text
);
