-- QZ-27: versioned family consent with an enforced re-consent gate (additive).
create table public.consent_versions(
 version integer primary key check (version >= 1),
 summary text not null check (length(summary) between 10 and 300),
 body text not null check (length(body) between 20 and 4000),
 published_at timestamptz not null default now()
);
insert into public.consent_versions(version, summary, body) values (1,
 'Original family consent',
 'I am the adult guardian and consent to storing family nicknames, age in years, preferences, and gameplay activity. I will supervise play. I understand there is no child messaging.');

alter table public.households add column consent_version integer not null default 1 references public.consent_versions(version);
create table public.consent_records(
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households on delete cascade,
 version integer not null references public.consent_versions(version),
 actor uuid not null references auth.users on delete cascade,
 accepted_at timestamptz not null default now(),
 unique (household_id, version)
);
create index consent_records_version on public.consent_records(version);
create index consent_records_actor on public.consent_records(actor);
create index households_consent_version on public.households(consent_version);
insert into public.consent_records(household_id, version, actor, accepted_at)
 select id, 1, guardian_id, consented_at from public.households;

do $$declare t text;begin foreach t in array array['consent_versions','consent_records'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end$$;
create policy consent_texts on public.consent_versions for select to authenticated using(true);
create policy own_consent_records on public.consent_records for select to authenticated using(private.owns(household_id));

create function private.current_consent() returns integer language sql stable security definer set search_path='' as $$
 select coalesce(max(version),1) from public.consent_versions
$$;
revoke all on function private.current_consent() from public, anon, authenticated;

-- New households consent to the current text and get a matching record.
create function private.household_consent_stamp() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='INSERT' and TG_WHEN='BEFORE' then NEW.consent_version:=private.current_consent(); return NEW; end if;
 insert into public.consent_records(household_id,version,actor) values(NEW.id,NEW.consent_version,NEW.guardian_id) on conflict do nothing;
 return NEW;
end$$;
create trigger households_consent_before before insert on public.households for each row execute function private.household_consent_stamp();
create trigger households_consent_after after insert on public.households for each row execute function private.household_consent_stamp();

-- Gate: no new play or SafeZone registration on an outdated consent.
create function private.consent_gate() returns trigger language plpgsql security definer set search_path='' as $$
declare hv integer;
begin
 -- Nested IF: plpgsql does not short-circuit AND, and game_sessions has no "status".
 if TG_TABLE_NAME='town_hall_registrations' then
  if NEW.status<>'registered' then return NEW; end if;
 end if;
 select consent_version into hv from public.households where id=NEW.household_id;
 if hv < private.current_consent() then
  raise exception 'Please review and accept the updated family consent before starting new activities.';
 end if;
 return NEW;
end$$;
create trigger sessions_consent_gate before insert on public.game_sessions for each row execute function private.consent_gate();
create trigger registrations_consent_gate before insert or update of status on public.town_hall_registrations for each row execute function private.consent_gate();

create function private.consent_accept(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; cur integer:=private.current_consent();
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 select id into hid from public.households where guardian_id=uid for update;
 if hid is null then raise exception 'Create a household first';end if;
 if (payload->>'version')::int is distinct from cur then raise exception 'Accept the current consent version (%)', cur;end if;
 insert into public.consent_records(household_id,version,actor) values(hid,cur,uid) on conflict do nothing;
 update public.households set consent_version=cur where id=hid;
 insert into public.audit_events(household_id,actor,action,detail) values(hid,uid,'consent_accept',jsonb_build_object('version',cur));
 return jsonb_build_object('version',cur);
end$$;
revoke all on function private.consent_gate(), private.household_consent_stamp(), private.consent_accept(jsonb) from public, anon, authenticated;
grant execute on function private.consent_accept(jsonb) to authenticated;

-- Read: the household's consent position (current text only when action is needed).
create function private.consent_status() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'current', private.current_consent(),
  'accepted', h.consent_version,
  'pending', h.consent_version < private.current_consent(),
  'text', case when h.consent_version < private.current_consent() then (select jsonb_build_object('summary',summary,'body',body) from public.consent_versions where version=private.current_consent()) end,
  'history', coalesce((select jsonb_agg(jsonb_build_object('version',r.version,'acceptedAt',r.accepted_at) order by r.version) from public.consent_records r where r.household_id=h.id),'[]'::jsonb))
 from public.households h where h.guardian_id=(select auth.uid())
$$;
revoke all on function private.consent_status() from public, anon, authenticated;
grant execute on function private.consent_status() to authenticated;
create function public.qz_consent_status() returns jsonb language sql stable security invoker set search_path='' as $$select private.consent_status()$$;
revoke all on function public.qz_consent_status() from public, anon;
grant execute on function public.qz_consent_status() to authenticated;

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
