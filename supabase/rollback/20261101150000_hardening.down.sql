drop policy content_challenges on public.challenges;
create policy content_challenges on public.challenges for select to authenticated using(true);
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select case
  when command in ('child_update','child_archive','child_delete','account_delete','export') then private.family_command(command,payload)
  when command like 'sz\_%' then private.safezone_command(command,payload)
  else private.command(command,payload) end
$$;
drop function public.qz_rate(text);
drop function private.rate_check(text);
drop function private.rate_command();
drop function private.rate_limit(text,integer,integer);
drop table private.rate_events;
