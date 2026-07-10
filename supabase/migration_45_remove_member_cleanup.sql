-- Migration 45: Fix remove_member to clean up birthday when a member is removed from the group.
-- Previously, removing a member via the in-app admin panel left their birthday entry behind.

create or replace function remove_member(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  grp_id uuid := current_community_group_id();
begin
  if not is_group_admin() then
    raise exception 'Only admins can remove members';
  end if;
  if auth.uid() = target_user_id then
    raise exception 'You cannot remove yourself';
  end if;
  if not exists (
    select 1 from profiles
    where user_id = target_user_id and community_group_id = grp_id
  ) then
    raise exception 'User is not in your group';
  end if;
  -- Remove from all conversations in this group
  delete from conversation_members
  where user_id = target_user_id
    and conversation_id in (
      select id from conversations where community_group_id = grp_id
    );
  -- Delete birthday entry so it doesn't linger after removal
  delete from birthdays where user_id = target_user_id;
  -- Delete profile (revokes all group data access via RLS)
  delete from profiles where user_id = target_user_id and community_group_id = grp_id;
end;
$$;
