-- QZ-29: Q hint usage limits per household, attributable usage (additive).
alter table public.guardian_permissions add column q_daily_limit integer not null default 20 check (q_daily_limit between 1 and 50);
alter table public.ai_evaluations add column household_id uuid references public.households on delete cascade;
update public.ai_evaluations e set household_id=g.household_id from public.game_sessions g where g.id=e.session_id;
create index ai_household_day on public.ai_evaluations(household_id, created_at);

-- Attribute every evaluation to its household and enforce the guardian's daily limit.
create function private.hints_budget() returns trigger language plpgsql security definer set search_path='' as $$
declare cap integer; used integer;
begin
 select household_id into NEW.household_id from public.game_sessions where id=NEW.session_id;
 select q_daily_limit into cap from public.guardian_permissions where household_id=NEW.household_id;
 select count(*) into used from public.ai_evaluations where household_id=NEW.household_id and created_at > now()-interval '24 hours';
 if used >= coalesce(cap,20) then
  raise exception 'Your family has used today''s % guided hints. They refresh within 24 hours.', coalesce(cap,20);
 end if;
 return NEW;
end$$;
create trigger hints_budget before insert on public.ai_evaluations for each row execute function private.hints_budget();

create function private.q_budget(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 select id into hid from public.households where guardian_id=uid;
 if hid is null then raise exception 'Create a household first';end if;
 if jsonb_typeof(payload->'limit') is distinct from 'number' then raise exception 'Choose a daily hint limit';end if;
 update public.guardian_permissions set q_daily_limit=(payload->>'limit')::int where household_id=hid;
 insert into public.audit_events(household_id,actor,action,detail) values(hid,uid,'q_budget',jsonb_build_object('limit',(payload->>'limit')::int));
 return '{}'::jsonb;
end$$;

create function private.q_usage() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'used', (select count(*) from public.ai_evaluations e where e.household_id=h.id and e.created_at > now()-interval '24 hours'),
  'limit', (select q_daily_limit from public.guardian_permissions where household_id=h.id))
 from public.households h where h.guardian_id=(select auth.uid())
$$;
revoke all on function private.hints_budget(), private.q_budget(jsonb), private.q_usage() from public, anon, authenticated;
grant execute on function private.q_budget(jsonb), private.q_usage() to authenticated;
create function public.qz_q_usage() returns jsonb language sql stable security invoker set search_path='' as $$select private.q_usage()$$;
revoke all on function public.qz_q_usage() from public, anon;
grant execute on function public.qz_q_usage() to authenticated;

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
 elsif command='q_budget' then
  return private.q_budget(payload);
 end if;
 return private.command(command,payload);
end$$;
