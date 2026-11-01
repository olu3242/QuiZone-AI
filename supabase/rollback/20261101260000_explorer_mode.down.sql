-- Reverse of 20261101260000_explorer_mode.sql. Every Explorer-mode lock is lifted.
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
 if command='account_delete' then
  perform private.member_offboard();
  return private.family_command(command,payload);
 elsif command in ('child_update','child_archive','child_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 elsif command like 'cms\_%' then
  return private.cms_command(command,payload);
 elsif command like 'member\_%' then
  return private.member_command(command,payload);
 elsif command='presence' then
  return private.presence(payload);
 elsif command='create' and (payload->>'practice')='true' then
  r:=private.command(command,payload-'practice');
  perform private.mark_practice((r->>'session')::uuid);
  return r;
 elsif command='consent_accept' then
  return private.consent_accept(payload);
 elsif command='q_budget' then
  return private.q_budget(payload);
 end if;
 return private.command(command,payload);
end$$;
create or replace function private.owns(h uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.households where id=h and guardian_id=(select auth.uid()))$$;
drop function private.explorer_lock();
drop function public.qz_locked();
drop function private.locked();
drop function private.jwt_session();
drop table private.explorer_locks;
