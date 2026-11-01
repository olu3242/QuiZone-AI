-- Reverse of 20261101310000_cms_country.sql.
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
 -- Explorer mode: a locked session may only play.
 if private.locked() and command not in ('create','transition','answer','plan','blueprint','hint','report','presence','explorer_lock') then
  raise exception 'Explorer mode is on. A grown-up can unlock it with their password.';
 end if;
 if command='explorer_lock' then
  return private.explorer_lock();
 end if;
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
 elsif command='notice_read' then
  return private.notice_read(payload);
 end if;
 return private.command(command,payload);
end$$;
drop function private.cms_country(jsonb);
