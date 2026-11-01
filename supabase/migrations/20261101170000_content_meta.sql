-- QZ-21: challenge subject + difficulty (additive) and the admin cms_* command family.
alter table public.challenges
 add column subject text not null default 'general'
  check (subject in ('science','math','environment','civics','world','creativity','general')),
 add column difficulty text not null default 'explorer'
  check (difficulty in ('starter','explorer','challenger'));
update public.challenges set
 subject=case mode when 'quick' then 'science' when 'solve' then 'environment' when 'build' then 'creativity' when 'debate' then 'civics' else 'world' end,
 difficulty=case mode when 'quick' then 'starter' when 'debate' then 'challenger' else 'explorer' end;
create index challenges_filters on public.challenges(subject, difficulty);

create function private.cms_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ref uuid;
begin
 if uid is null or not private.is_staff('admin') then raise exception 'Content tools require an administrator role';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 if command='cms_meta' then
  update public.challenges set subject=payload->>'subject', difficulty=payload->>'difficulty' where id=(payload->>'challenge')::uuid returning id into ref;
  if ref is null then raise exception 'Challenge not found';end if;
 else raise exception 'Unknown command';end if;
 insert into public.audit_events(household_id,actor,action,reference_id) values(null,uid,command,ref);
 return '{}'::jsonb;
end$$;
revoke all on function private.cms_command(text,jsonb) from public, anon, authenticated;
grant execute on function private.cms_command(text,jsonb) to authenticated;

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
