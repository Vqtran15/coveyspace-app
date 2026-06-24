-- RPC: get_invite_code — returns the invite code only for admins
create or replace function get_invite_code()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not is_group_admin() then
    raise exception 'Only admins can view the invite code';
  end if;
  return (
    select invite_code from community_groups
    where id = current_community_group_id()
  );
end;
$$;
