create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform private.rate_command();
 if command in ('child_update','child_archive','child_delete','account_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 end if;
 return private.command(command,payload);
end$$;
drop function private.cms_command(text,jsonb);
drop index public.challenges_filters;
alter table public.challenges drop column subject, drop column difficulty;
