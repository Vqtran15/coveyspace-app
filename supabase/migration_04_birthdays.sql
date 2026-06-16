create table if not exists birthdays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birthday date not null,
  created_at timestamptz default now()
);

alter table birthdays enable row level security;

create policy "public read birthdays"   on birthdays for select using (true);
create policy "public insert birthdays" on birthdays for insert with check (true);
create policy "public update birthdays" on birthdays for update using (true);
create policy "public delete birthdays" on birthdays for delete using (true);

alter publication supabase_realtime add table birthdays;
