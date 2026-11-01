drop trigger passport_practice on public.passport_entries;
drop trigger score_events_practice on public.score_events;
drop function private.skip_practice_progress();
drop function private.mark_practice(uuid);
alter table public.game_sessions drop column practice;
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform private.rate_command();
 if command in ('child_update','child_archive','child_delete','account_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 elsif command like 'cms\_%' then
  return private.cms_command(command,payload);
 end if;
 return private.command(command,payload);
end$$;
