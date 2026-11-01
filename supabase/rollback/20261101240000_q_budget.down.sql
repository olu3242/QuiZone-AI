drop function public.qz_q_usage();
drop function private.q_usage();
drop function private.q_budget(jsonb);
drop trigger hints_budget on public.ai_evaluations;
drop function private.hints_budget();
drop index public.ai_household_day;
alter table public.ai_evaluations drop column household_id;
alter table public.guardian_permissions drop column q_daily_limit;
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
 elsif command='consent_accept' then
  return private.consent_accept(payload);
 end if;
 return private.command(command,payload);
end$$;
