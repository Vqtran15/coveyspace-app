-- migration_38_feedback.sql
-- Feedback table for in-app user submissions.
-- After running this migration, set up a Supabase database webhook:
--   Table: feedback | Event: INSERT | URL: <your edge function URL>/send-feedback-email

create table if not exists feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text,
  email         text,
  group_name    text,
  type          text not null check (type in ('bug', 'feature', 'general')),
  message       text not null,
  created_at    timestamptz default now()
);

alter table feedback enable row level security;

-- Authenticated users can submit feedback for themselves only
create policy "users can submit feedback"
  on feedback for insert
  to authenticated
  with check (auth.uid() = user_id);
