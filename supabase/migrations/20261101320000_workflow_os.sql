-- QZ-39: Workflow OS — a database-native event outbox, versioned workflow definitions,
-- and a runtime with retries, idempotency, dead letters, and a per-step run log (additive).
--
--   domain trigger ──emit──▶ private.wf_events (typed, idempotent)
--                              │ dispatch (inline, same transaction)
--                              ▼
--   private.wf_definitions ─▶ private.wf_runs ─▶ private.wf_steps
--   (data: whitelisted         (pending → running → succeeded | failed → … → dead;
--    action names only)         paused while a workflow is paused)
--                              ▲
--   pg_cron every minute ──────┘ private.wf_tick(): retries due runs, emits clock events
--
-- Definitions are data, actions are code: a definition can only name actions in
-- private.wf_action's whitelist, so no definition can run arbitrary SQL.
-- Nothing here is readable or writable by clients; administrators inspect and steer it
-- through private.wf_overview / private.wf_command.

create table private.wf_definitions(
 key text not null check (key ~ '^[a-z][a-z0-9_.]{2,60}$'),
 version integer not null check (version >= 1),
 event text not null check (event ~ '^[a-z][a-z0-9_.]{2,60}$'),
 steps jsonb not null check (jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 10),
 description text not null check (length(description) between 10 and 200),
 enabled boolean not null default true,
 max_attempts integer not null default 5 check (max_attempts between 1 and 10),
 created_at timestamptz not null default now(),
 primary key (key, version));
create table private.wf_events(
 id bigserial primary key,
 type text not null,
 household_id uuid references public.households on delete cascade,
 ref uuid,
 payload jsonb not null default '{}'::jsonb,
 idempotency_key text not null unique,
 created_at timestamptz not null default now());
create index wf_events_created on private.wf_events(created_at);
create table private.wf_runs(
 id bigserial primary key,
 workflow_key text not null,
 workflow_version integer not null,
 event_id bigint not null references private.wf_events on delete cascade,
 status text not null check (status in ('pending','running','succeeded','failed','dead','paused')),
 attempt integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 last_error text,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 unique (workflow_key, event_id),
 foreign key (workflow_key, workflow_version) references private.wf_definitions);
create index wf_runs_due on private.wf_runs(status, next_attempt_at);
create table private.wf_steps(
 id bigserial primary key,
 run_id bigint not null references private.wf_runs on delete cascade,
 attempt integer not null,
 ordinal integer not null,
 action text not null,
 status text not null check (status in ('succeeded','failed')),
 started_at timestamptz not null,
 finished_at timestamptz not null,
 error text,
 output jsonb);
create index wf_steps_run on private.wf_steps(run_id);
do $$declare t text; begin
 foreach t in array array['wf_definitions','wf_events','wf_runs','wf_steps'] loop
  execute format('alter table private.%I enable row level security', t);
  execute format('revoke all on private.%I from public, anon, authenticated', t);
 end loop;
end$$;

-- The action whitelist. A definition may only name these.
create function private.wf_known_action(a text) returns boolean language sql immutable set search_path='' as $$
 select a in ('notify_badge','notify_member','notify_report','notify_consent','notify_member_game','maintenance')$$;
create function private.wf_check_definition() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from jsonb_array_elements(NEW.steps) s where jsonb_typeof(s)<>'string' or not private.wf_known_action(s#>>'{}')) then
  raise exception 'Workflow % v% names an unknown action', NEW.key, NEW.version;
 end if;
 return NEW;
end$$;
create trigger wf_definitions_check before insert or update on private.wf_definitions for each row execute function private.wf_check_definition();

-- Members hosting games is a new thing for the guardian to hear about.
alter table public.family_notifications drop constraint family_notifications_kind_check;
alter table public.family_notifications add constraint family_notifications_kind_check
 check (kind in ('report_status','member_joined','member_left','game_night','consent_update','badge','member_game'));
drop index public.family_notifications_once;
create unique index family_notifications_once on public.family_notifications(household_id, kind, ref)
 where ref is not null and kind in ('game_night','consent_update','badge','member_game');

create function private.wf_action(a text, ev private.wf_events) returns jsonb language plpgsql security definer set search_path='' as $$
declare nm text; who text; actor uuid; title text; pts int; n int;
begin
 case a
 when 'notify_badge' then
  select name into nm from public.badges where code=ev.payload->>'code';
  if ev.payload->>'scope'='household' then
   perform private.notify(ev.household_id,'badge','Family badge: '||nm,'','/passport',private.badge_ref((ev.payload->>'holder')::uuid,ev.payload->>'code'));
  else
   select nickname into who from public.child_profiles where id=(ev.payload->>'holder')::uuid;
   if who is null then return jsonb_build_object('skipped','explorer no longer exists'); end if;
   perform private.notify(ev.household_id,'badge',who||' earned '||nm,'','/passport',private.badge_ref((ev.payload->>'holder')::uuid,ev.payload->>'code'));
  end if;
 when 'notify_member' then
  if ev.type='member.joined' then
   perform private.notify(ev.household_id,'member_joined',(ev.payload->>'name')||' joined your family','They can host and play games on their own device.','/family',null);
  else
   perform private.notify(ev.household_id,'member_left',(ev.payload->>'name')||' no longer has access','','/family',null);
  end if;
 when 'notify_report' then
  perform private.notify(ev.household_id,'report_status',
   case ev.payload->>'status' when 'under_review' then 'A report is being reviewed' when 'actioned' then 'A report led to a change'
    when 'dismissed' then 'A report was reviewed: no change needed' else 'A report was escalated for more review' end,
   'Thank you for helping keep QuiZone safe.','/parent',null);
 when 'notify_consent' then
  insert into public.family_notifications(household_id,kind,title,body,link,ref)
   select h.id,'consent_update','Updated family consent to review',left(ev.payload->>'summary',300),'/parent',private.badge_ref(h.id,'consent:'||(ev.payload->>'version'))
   from public.households h where h.consent_version<(ev.payload->>'version')::int
  on conflict do nothing;
  get diagnostics n=row_count;
  return jsonb_build_object('households',n);
 when 'notify_member_game' then
  -- Only games a family member (not the guardian) started.
  select e.actor into actor from public.audit_events e where e.action='create' and e.reference_id=ev.ref order by e.created_at limit 1;
  select m.display_name into who from public.household_members m where m.household_id=ev.household_id and m.user_id=actor;
  if who is null then return jsonb_build_object('skipped','hosted by the guardian'); end if;
  select c.title, g.total_score into title, pts from public.game_sessions g join public.challenge_versions v on v.id=g.challenge_version_id join public.challenges c on c.id=v.challenge_id where g.id=ev.ref;
  perform private.notify(ev.household_id,'member_game',who||' hosted '||coalesce(title,'a game'),'The family scored '||coalesce(pts,0)||' points.','/parent',ev.ref);
 when 'maintenance' then
  return private.maintenance('cron');
 else
  raise exception 'Unknown workflow action %', a;
 end case;
 return '{}'::jsonb;
end$$;

-- Errors are kept for operators without identifiers in them.
create function private.wf_scrub(msg text) returns text language sql immutable set search_path='' as $$
 select left(regexp_replace(coalesce(msg,''),'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}','<id>','g'),300)$$;

create function private.wf_execute(rid bigint) returns text language plpgsql security definer set search_path='' as $$
declare r private.wf_runs; ev private.wf_events; d private.wf_definitions; i int; a text; outp jsonb; err text; t0 timestamptz;
begin
 select * into r from private.wf_runs where id=rid for update skip locked;
 if not found or r.status not in ('pending','failed') then return coalesce(r.status,'locked'); end if;
 select * into ev from private.wf_events where id=r.event_id;
 select * into d from private.wf_definitions where key=r.workflow_key and version=r.workflow_version;
 update private.wf_runs set status='running', attempt=attempt+1, started_at=now() where id=rid returning * into r;
 for i in 0..jsonb_array_length(d.steps)-1 loop
  a := d.steps->>i;
  -- Resume after the last step that already succeeded (steps are idempotent anyway).
  if exists(select 1 from private.wf_steps where run_id=rid and ordinal=i and status='succeeded') then continue; end if;
  t0 := clock_timestamp();
  begin
   outp := private.wf_action(a, ev);
   insert into private.wf_steps(run_id,attempt,ordinal,action,status,started_at,finished_at,output) values(rid,r.attempt,i,a,'succeeded',t0,clock_timestamp(),outp);
  exception when others then
   err := private.wf_scrub(SQLERRM);
   insert into private.wf_steps(run_id,attempt,ordinal,action,status,started_at,finished_at,error) values(rid,r.attempt,i,a,'failed',t0,clock_timestamp(),err);
   update private.wf_runs set
     status=case when r.attempt>=d.max_attempts then 'dead' else 'failed' end,
     last_error=err,
     -- Exponential backoff: 30 s, 2 min, 8 min, 32 min, then hourly.
     next_attempt_at=now()+make_interval(secs=>least(3600, 30*power(4, r.attempt-1))::int),
     finished_at=case when r.attempt>=d.max_attempts then now() end
    where id=rid;
   return case when r.attempt>=d.max_attempts then 'dead' else 'failed' end;
  end;
 end loop;
 update private.wf_runs set status='succeeded', finished_at=now(), last_error=null where id=rid;
 return 'succeeded';
end$$;

create function private.wf_dispatch(eid bigint) returns void language plpgsql security definer set search_path='' as $$
declare ev private.wf_events; d record; rid bigint;
begin
 select * into ev from private.wf_events where id=eid;
 -- The live version of each workflow listening for this event type.
 for d in select distinct on (key) * from private.wf_definitions where event=ev.type order by key, version desc loop
  insert into private.wf_runs(workflow_key,workflow_version,event_id,status)
   values(d.key,d.version,eid,case when d.enabled then 'pending' else 'paused' end)
   on conflict (workflow_key,event_id) do nothing returning id into rid;
  if rid is not null and d.enabled then perform private.wf_execute(rid); end if;
 end loop;
end$$;

-- Emit an event once per idempotency key; dispatch it inline. Returns the event id
-- (null when it was a duplicate or its household is being deleted).
create function private.wf_emit(t text, h uuid, r uuid, p jsonb, k text) returns bigint language plpgsql security definer set search_path='' as $$
declare eid bigint;
begin
 if h is not null and not exists(select 1 from public.households where id=h) then return null; end if;
 insert into private.wf_events(type,household_id,ref,payload,idempotency_key) values(t,h,r,coalesce(p,'{}'::jsonb),k)
  on conflict (idempotency_key) do nothing returning id into eid;
 if eid is not null then perform private.wf_dispatch(eid); end if;
 return eid;
end$$;

-- The runtime tick: emit the quarter-hour clock, run every due run, prune old history.
create function private.wf_tick(max_runs integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; res text; ok int:=0; failed int:=0; dead int:=0; pruned int;
begin
 perform private.wf_emit('clock.quarter_hour',null,null,'{}'::jsonb,'clock:'||floor(extract(epoch from now())/900)::bigint);
 for r in select id from private.wf_runs
   where status='pending' or (status='failed' and next_attempt_at<=now())
   order by next_attempt_at limit greatest(1,least(max_runs,500)) for update skip locked loop
  res := private.wf_execute(r.id);
  if res='succeeded' then ok:=ok+1; elsif res='dead' then dead:=dead+1; elsif res='failed' then failed:=failed+1; end if;
 end loop;
 delete from private.wf_events e where e.created_at<now()-interval '30 days'
  and not exists(select 1 from private.wf_runs x where x.event_id=e.id and x.status in ('pending','running','failed','dead','paused'));
 get diagnostics pruned=row_count;
 return jsonb_build_object('succeeded',ok,'failed',failed,'dead',dead,'prunedEvents',pruned);
end$$;

-- Administrators: inspect (no household ids, payloads, or names) and steer.
create function private.wf_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.is_staff('admin') then raise exception 'Operations tools require an administrator role';end if;
 return jsonb_build_object(
  'definitions',coalesce((select jsonb_agg(jsonb_build_object('key',d.key,'version',d.version,'event',d.event,'steps',d.steps,
     'description',d.description,'enabled',d.enabled,'maxAttempts',d.max_attempts,
     'versions',(select count(*) from private.wf_definitions x where x.key=d.key),
     'last24h',coalesce((select jsonb_object_agg(s.status,s.n) from (select status,count(*) n from private.wf_runs r where r.workflow_key=d.key and r.created_at>now()-interval '24 hours' group by status) s),'{}'::jsonb))
    order by d.key)
   from (select distinct on (key) * from private.wf_definitions order by key, version desc) d),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'workflow',r.workflow_key,'version',r.workflow_version,'event',e.type,
     'status',r.status,'attempt',r.attempt,'error',r.last_error,'createdAt',r.created_at,'finishedAt',r.finished_at,
     'nextAttemptAt',case when r.status='failed' then r.next_attempt_at end,
     'steps',coalesce((select jsonb_agg(jsonb_build_object('action',s.action,'attempt',s.attempt,'status',s.status,
        'ms',round(extract(epoch from s.finished_at-s.started_at)*1000),'error',s.error) order by s.id) from private.wf_steps s where s.run_id=r.id),'[]'::jsonb))
    order by r.id desc)
   from (select * from private.wf_runs order by id desc limit 30) r join private.wf_events e on e.id=r.event_id),'[]'::jsonb),
  'deadLetters',(select count(*) from private.wf_runs where status='dead'),
  'due',(select count(*) from private.wf_runs where status='pending' or (status='failed' and next_attempt_at<=now())));
end$$;

create function private.wf_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); n int; res jsonb:='{}'::jsonb;
begin
 if uid is null or not private.is_staff('admin') then raise exception 'Operations tools require an administrator role';end if;
 if command='wf_pause' or command='wf_resume' then
  update private.wf_definitions set enabled=(command='wf_resume') where key=payload->>'workflow';
  get diagnostics n=row_count;
  if n=0 then raise exception 'Workflow not found';end if;
  -- Resuming releases the runs that queued up while paused; the next tick runs them.
  if command='wf_resume' then update private.wf_runs set status='pending', next_attempt_at=now() where workflow_key=payload->>'workflow' and status='paused'; end if;
 elsif command='wf_retry' then
  update private.wf_runs set status='pending', attempt=0, next_attempt_at=now(), finished_at=null
   where id=(payload->>'run')::bigint and status in ('failed','dead');
  get diagnostics n=row_count;
  if n=0 then raise exception 'Only failed or dead runs can be retried';end if;
 elsif command='wf_tick' then
  res:=private.wf_tick();
 else raise exception 'Unknown command';
 end if;
 insert into public.audit_events(actor,action,detail) values(uid,command,payload);
 return res;
end$$;

-- Emitters: domain changes become events (replacing QZ-36's direct-notify triggers).
drop trigger notify_report on public.moderation_cases;
drop trigger notify_member on public.household_members;
drop trigger notify_child_badge on public.child_badges;
drop trigger notify_household_badge on public.household_badges;
drop trigger notify_consent on public.consent_versions;
drop function private.notify_report();
drop function private.notify_member();
drop function private.notify_badge();
drop function private.notify_consent();

create function private.wf_emit_domain() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 case TG_TABLE_NAME
 when 'moderation_cases' then
  if NEW.status is distinct from OLD.status then
   perform private.wf_emit('report.status_changed',NEW.household_id,NEW.id,jsonb_build_object('status',NEW.status),
    'report:'||NEW.id||':'||NEW.status||':'||extract(epoch from clock_timestamp()));
  end if;
 when 'household_members' then
  if TG_OP='INSERT' then
   perform private.wf_emit('member.joined',NEW.household_id,NEW.user_id,jsonb_build_object('name',NEW.display_name),
    'member.joined:'||NEW.household_id||':'||NEW.user_id||':'||extract(epoch from NEW.joined_at));
  else
   perform private.wf_emit('member.left',OLD.household_id,OLD.user_id,jsonb_build_object('name',OLD.display_name),
    'member.left:'||OLD.household_id||':'||OLD.user_id||':'||extract(epoch from clock_timestamp()));
   return OLD;
  end if;
 when 'child_badges' then
  select household_id into h from public.child_profiles where id=NEW.child_id;
  perform private.wf_emit('badge.awarded',h,NEW.child_id,jsonb_build_object('scope','child','holder',NEW.child_id,'code',NEW.badge_code),
   'badge:'||NEW.child_id||':'||NEW.badge_code);
 when 'household_badges' then
  perform private.wf_emit('badge.awarded',NEW.household_id,NEW.household_id,jsonb_build_object('scope','household','holder',NEW.household_id,'code',NEW.badge_code),
   'badge:'||NEW.household_id||':'||NEW.badge_code);
 when 'consent_versions' then
  perform private.wf_emit('consent.published',null,null,jsonb_build_object('version',NEW.version,'summary',NEW.summary),'consent:'||NEW.version);
 when 'game_sessions' then
  if NEW.state='complete' and OLD.state is distinct from 'complete' then
   perform private.wf_emit('game.completed',NEW.household_id,NEW.id,jsonb_build_object('practice',NEW.practice),'game.completed:'||NEW.id);
  end if;
 end case;
 return NEW;
end$$;
create trigger wf_emit_report after update of status on public.moderation_cases for each row execute function private.wf_emit_domain();
create trigger wf_emit_member after insert or delete on public.household_members for each row execute function private.wf_emit_domain();
create trigger wf_emit_child_badge after insert on public.child_badges for each row execute function private.wf_emit_domain();
create trigger wf_emit_household_badge after insert on public.household_badges for each row execute function private.wf_emit_domain();
create trigger wf_emit_consent after insert on public.consent_versions for each row execute function private.wf_emit_domain();
create trigger wf_emit_game after update of state on public.game_sessions for each row execute function private.wf_emit_domain();

insert into private.wf_definitions(key,version,event,steps,description) values
 ('badge.notify',1,'badge.awarded','["notify_badge"]','Tell the guardian when an explorer or the family earns a badge.'),
 ('member.joined.notify',1,'member.joined','["notify_member"]','Tell the guardian when an invited adult joins the family.'),
 ('member.left.notify',1,'member.left','["notify_member"]','Tell the guardian when a family member loses access.'),
 ('report.status.notify',1,'report.status_changed','["notify_report"]','Tell the guardian when staff review one of their reports.'),
 ('consent.notify',1,'consent.published','["notify_consent"]','Ask every household on an older consent version to review the new one.'),
 ('game.member_hosted.notify',1,'game.completed','["notify_member_game"]','Tell the guardian when a family member hosted a completed game.'),
 ('ops.maintenance',1,'clock.quarter_hour','["maintenance"]','Expire stale games, prune old records, and send game-night reminders.');

revoke all on function private.wf_known_action(text), private.wf_check_definition(), private.wf_action(text,private.wf_events), private.wf_scrub(text),
 private.wf_execute(bigint), private.wf_dispatch(bigint), private.wf_emit(text,uuid,uuid,jsonb,text), private.wf_tick(integer),
 private.wf_overview(), private.wf_command(text,jsonb), private.wf_emit_domain() from public, anon, authenticated;
grant execute on function private.wf_overview(), private.wf_command(text,jsonb) to authenticated;
create function public.qz_workflows() returns jsonb language sql stable security invoker set search_path='' as $$select private.wf_overview()$$;
revoke all on function public.qz_workflows() from public, anon;
grant execute on function public.qz_workflows() to authenticated;

-- The runtime ticks every minute; maintenance now runs as the ops.maintenance workflow.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $q$select cron.unschedule(jobid) from cron.job where jobname='qz-maintenance'$q$;
  perform cron.schedule('qz-workflows','* * * * *',$job$select private.wf_tick()$job$);
 end if;
end$$;

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
 elsif command like 'wf\_%' then
  return private.wf_command(command,payload);
 elsif command='cms_country' then
  return private.cms_country(payload);
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
