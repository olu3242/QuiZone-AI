drop function public.qz_consent_status();
drop function private.consent_status();
drop trigger registrations_consent_gate on public.town_hall_registrations;
drop trigger sessions_consent_gate on public.game_sessions;
drop trigger households_consent_after on public.households;
drop trigger households_consent_before on public.households;
drop function private.consent_accept(jsonb);
drop function private.consent_gate();
drop function private.household_consent_stamp();
drop function private.current_consent();
drop table public.consent_records;
alter table public.households drop column consent_version;
drop table public.consent_versions;
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
 if command in ('child_update','child_archive','child_delete','account_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 elsif command like 'cms\_%' then
  return private.cms_command(command,payload);
 elsif command='create' and (payload->>'practice')='true' then
  r:=private.command(command,payload-'practice');
  perform private.mark_practice((r->>'session')::uuid);
  return r;
 end if;
 return private.command(command,payload);
end$$;
