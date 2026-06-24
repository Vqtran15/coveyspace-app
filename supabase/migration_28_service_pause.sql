alter table serving_pages
  add column if not exists is_paused boolean default false;

create or replace function toggle_service_pause(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_group_admin() then
    raise exception 'Only admins can pause service signup';
  end if;
  update serving_pages
  set is_paused = not coalesce(is_paused, false)
  where id = p_page_id;
end;
$$;
