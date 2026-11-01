-- QZ-24: badges earned only from recorded activity (PRD §11). Additive.
-- Awarded by triggers on score_events / passport_entries, which the server
-- writes on completion; clients cannot insert badges or the events behind them.
create table public.badges(
 code text primary key,
 scope text not null check (scope in ('child','household')),
 name text not null,
 description text not null,
 sort integer not null
);
insert into public.badges values
 ('first_adventure','child','First adventure','Completed a first adventure with the family.',1),
 ('quick_spark','child','Quick spark','Completed a QuickZone adventure.',2),
 ('solve_spark','child','Problem solver','Completed a SolveZone adventure.',3),
 ('build_spark','child','Builder','Completed a BuildZone adventure.',4),
 ('debate_spark','child','Fair debater','Completed a DebateZone adventure.',5),
 ('world_spark','child','World explorer','Completed a WorldZone adventure.',6),
 ('globe_stamp','child','First stamp','Earned a first passport stamp.',7),
 ('all_zones','child','Five-zone explorer','Completed an adventure in every zone.',8),
 ('ten_adventures','child','Ten adventures','Completed ten adventures.',9),
 ('family_first','household','First game night','The family completed its first game night.',20),
 ('whole_crew','household','Whole crew','Three or more explorers finished an adventure together.',21),
 ('family_five','household','Five game nights','The family completed five game nights.',22);

create table public.child_badges(
 child_id uuid not null references public.child_profiles on delete cascade,
 badge_code text not null references public.badges,
 session_id uuid references public.game_sessions on delete set null,
 awarded_at timestamptz not null default now(),
 primary key (child_id, badge_code)
);
create table public.household_badges(
 household_id uuid not null references public.households on delete cascade,
 badge_code text not null references public.badges,
 session_id uuid references public.game_sessions on delete set null,
 awarded_at timestamptz not null default now(),
 primary key (household_id, badge_code)
);
create index child_badges_session on public.child_badges(session_id);
create index child_badges_code on public.child_badges(badge_code);
create index household_badges_session on public.household_badges(session_id);
create index household_badges_code on public.household_badges(badge_code);
do $$declare t text;begin foreach t in array array['badges','child_badges','household_badges'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end$$;
create policy badges_catalog on public.badges for select to authenticated using(true);
create policy own_child_badges on public.child_badges for select to authenticated
 using(exists(select 1 from public.child_profiles c where c.id=child_id and private.owns(c.household_id)));
create policy own_household_badges on public.household_badges for select to authenticated using(private.owns(household_id));

create function private.award_child_badges(child uuid, sid uuid) returns void language plpgsql security definer set search_path='' as $$
declare done int; modes text[]; stamps int;
begin
 select count(*), array_agg(distinct c.mode) into done, modes
  from public.score_events e join public.game_sessions g on g.id=e.session_id
  join public.challenge_versions v on v.id=g.challenge_version_id join public.challenges c on c.id=v.challenge_id
  where e.child_id=child;
 select count(*) into stamps from public.passport_entries where child_id=child;
 insert into public.child_badges(child_id,badge_code,session_id)
 select child, b, sid from unnest(array_remove(array[
  case when done>=1 then 'first_adventure' end,
  case when 'quick'=any(modes) then 'quick_spark' end,
  case when 'solve'=any(modes) then 'solve_spark' end,
  case when 'build'=any(modes) then 'build_spark' end,
  case when 'debate'=any(modes) then 'debate_spark' end,
  case when 'world'=any(modes) then 'world_spark' end,
  case when stamps>=1 then 'globe_stamp' end,
  case when modes @> array['quick','solve','build','debate','world'] then 'all_zones' end,
  case when done>=10 then 'ten_adventures' end], null)) b
 on conflict do nothing;
end$$;

create function private.award_household_badges(hid uuid, sid uuid) returns void language plpgsql security definer set search_path='' as $$
declare nights int; crew int;
begin
 select count(*) into nights from public.game_sessions where household_id=hid and state='complete';
 select count(*) into crew from public.session_players where session_id=sid;
 insert into public.household_badges(household_id,badge_code,session_id)
 select hid, b, sid from unnest(array_remove(array[
  case when nights>=1 then 'family_first' end,
  case when crew>=3 then 'whole_crew' end,
  case when nights>=5 then 'family_five' end], null)) b
 on conflict do nothing;
end$$;

create function private.on_score_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.award_child_badges(NEW.child_id, NEW.session_id);
 perform private.award_household_badges((select household_id from public.game_sessions where id=NEW.session_id), NEW.session_id);
 return NEW;
end$$;
create trigger score_events_badges after insert on public.score_events for each row execute function private.on_score_event();
create function private.on_passport_entry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.award_child_badges(NEW.child_id, NEW.session_id);
 return NEW;
end$$;
create trigger passport_badges after insert on public.passport_entries for each row execute function private.on_passport_entry();
revoke all on function private.award_child_badges(uuid,uuid), private.award_household_badges(uuid,uuid),
 private.on_score_event(), private.on_passport_entry() from public, anon, authenticated;

-- Backfill from activity already on record.
do $$declare r record;begin
 for r in select distinct e.child_id, (select e2.session_id from public.score_events e2 where e2.child_id=e.child_id order by e2.created_at desc limit 1) sid from public.score_events e loop
  perform private.award_child_badges(r.child_id, r.sid);
 end loop;
 for r in select household_id, (array_agg(id order by completed_at desc))[1] sid from public.game_sessions where state='complete' group by household_id loop
  perform private.award_household_badges(r.household_id, r.sid);
 end loop;
end$$;
