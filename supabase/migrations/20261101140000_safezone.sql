-- SafeZone MVP: guardian-approved, human-moderated, structured town halls.
-- FAMILY.md §2: children never send free text to other users. Every contribution
-- is a moderator-authored statement/question/idea card, held for moderator
-- approval before peers see it, and shown only under a per-session pseudonym.

-- Operator-controlled feature flags (no client grants). SafeZone ships OFF.
create table private.feature_flags(flag text primary key, enabled boolean not null default false);
insert into private.feature_flags values ('safezone', false);
alter table private.feature_flags enable row level security;
revoke all on private.feature_flags from public, anon, authenticated;
create function private.flag(name text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from private.feature_flags where flag=name), false)
$$;

-- Guardian proved their password within `seconds` (JWT amr claim). Children use the
-- guardian's device, so consent must not be grantable from an idle signed-in screen.
create function private.recent_reauth(seconds integer default 300) returns boolean language plpgsql stable set search_path='' as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
 return exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) a
   where a->>'method'='password' and (a->>'timestamp')::bigint >= extract(epoch from now())::bigint - seconds);
end$$;

alter table public.guardian_permissions add column safezone boolean not null default false;

create table public.town_halls(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 6 and 100),
 summary text not null check(length(summary) between 20 and 500),
 category text not null check(category in ('school','community','environment','technology','future','family')),
 min_age integer not null check(min_age between 8 and 17),
 max_age integer not null check(max_age between 8 and 17),
 capacity integer not null check(capacity between 2 and 30),
 starts_at timestamptz not null,
 duration_minutes integer not null check(duration_minutes between 15 and 90),
 state text not null default 'draft' check(state in ('draft','scheduled','open','active','completed','cancelled')),
 current_item integer not null default 1,
 moderator_id uuid not null references auth.users,
 created_by uuid not null references auth.users,
 closed_reason text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 check(min_age <= max_age)
);
create table public.town_hall_agenda(
 town_hall_id uuid not null references public.town_halls on delete cascade,
 ordinal integer not null check(ordinal between 1 and 10),
 title text not null check(length(title) between 3 and 120),
 minutes integer not null check(minutes between 1 and 60),
 primary key(town_hall_id, ordinal)
);
create table public.town_hall_options(
 id uuid primary key default gen_random_uuid(),
 town_hall_id uuid not null references public.town_halls on delete cascade,
 agenda_ordinal integer,
 kind text not null check(kind in ('contribution','question','idea')),
 text text not null check(length(text) between 3 and 200),
 ordinal integer not null default 1
);
create table public.town_hall_registrations(
 town_hall_id uuid not null references public.town_halls on delete cascade,
 child_id uuid not null references public.child_profiles on delete cascade,
 household_id uuid not null references public.households on delete cascade,
 handle text not null,
 status text not null default 'registered' check(status in ('registered','withdrawn','removed')),
 consented_at timestamptz not null default now(),
 withdrawn_at timestamptz,
 removed_reason text,
 primary key(town_hall_id, child_id),
 unique(town_hall_id, handle)
);
create table public.town_hall_hands(
 id uuid primary key default gen_random_uuid(),
 town_hall_id uuid not null references public.town_halls on delete cascade,
 child_id uuid not null references public.child_profiles on delete cascade,
 state text not null default 'waiting' check(state in ('waiting','speaking','done','lowered')),
 raised_at timestamptz not null default now(),
 granted_at timestamptz
);
create unique index hands_one_open on public.town_hall_hands(town_hall_id, child_id) where state in ('waiting','speaking');
create unique index hands_one_speaker on public.town_hall_hands(town_hall_id) where state='speaking';
create table public.town_hall_contributions(
 id uuid primary key default gen_random_uuid(),
 town_hall_id uuid not null references public.town_halls on delete cascade,
 child_id uuid not null references public.child_profiles on delete cascade,
 option_id uuid not null references public.town_hall_options on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 reviewed_by uuid references auth.users,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(town_hall_id, child_id, option_id)
);
create table public.town_hall_polls(
 id uuid primary key default gen_random_uuid(),
 town_hall_id uuid not null references public.town_halls on delete cascade,
 question text not null check(length(question) between 6 and 200),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),
 state text not null default 'draft' check(state in ('draft','open','closed')),
 created_at timestamptz not null default now()
);
create table public.town_hall_votes(
 poll_id uuid not null references public.town_hall_polls on delete cascade,
 child_id uuid not null references public.child_profiles on delete cascade,
 choice integer not null check(choice between 0 and 5),
 created_at timestamptz not null default now(),
 primary key(poll_id, child_id)
);
create table public.safezone_reports(
 id uuid primary key default gen_random_uuid(),
 town_hall_id uuid not null references public.town_halls on delete cascade,
 household_id uuid references public.households on delete cascade,
 reporter uuid not null references auth.users on delete cascade,
 contribution_id uuid references public.town_hall_contributions on delete set null,
 handle text,
 reason text not null check(reason in ('bullying','unsafe','privacy','inappropriate','technical','removal','emergency')),
 severity text not null check(severity in ('low','high','urgent')),
 status text not null default 'open' check(status in ('open','under_review','actioned','dismissed','escalated')),
 created_at timestamptz not null default now()
);
create table public.safezone_report_events(
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.safezone_reports on delete cascade,
 actor uuid not null references auth.users on delete cascade,
 status text not null,
 note text check(note is null or length(note) <= 500),
 created_at timestamptz not null default now()
);
create table public.safezone_notifications(
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households on delete cascade,
 town_hall_id uuid not null references public.town_halls on delete cascade,
 child_id uuid references public.child_profiles on delete cascade,
 kind text not null check(kind in ('registered','withdrawn','removed','closed','report_update')),
 message text not null,
 created_at timestamptz not null default now()
);
create index halls_state on public.town_halls(state, starts_at);
create index regs_household on public.town_hall_registrations(household_id);
create index regs_child on public.town_hall_registrations(child_id);
create index hands_hall on public.town_hall_hands(town_hall_id, raised_at);
create index hands_child on public.town_hall_hands(child_id);
create index contrib_hall on public.town_hall_contributions(town_hall_id, status);
create index contrib_child on public.town_hall_contributions(child_id);
create index contrib_option on public.town_hall_contributions(option_id);
create index options_hall on public.town_hall_options(town_hall_id);
create index polls_hall on public.town_hall_polls(town_hall_id);
create index votes_child on public.town_hall_votes(child_id);
create index sz_reports_hall on public.safezone_reports(town_hall_id);
create index sz_reports_household on public.safezone_reports(household_id);
create index sz_reports_reporter on public.safezone_reports(reporter);
create index sz_reports_contrib on public.safezone_reports(contribution_id);
create index sz_events_report on public.safezone_report_events(report_id);
create index sz_events_actor on public.safezone_report_events(actor);
create index sz_notes_household on public.safezone_notifications(household_id, created_at desc);
create index sz_notes_hall on public.safezone_notifications(town_hall_id);
create index sz_notes_child on public.safezone_notifications(child_id);
create index halls_moderator on public.town_halls(moderator_id);
create index halls_creator on public.town_halls(created_by);
create index contrib_reviewer on public.town_hall_contributions(reviewed_by);

-- RLS: raw rows are household-private or staff-only. Cross-household views go
-- through the sanitized SECURITY DEFINER read functions below.
do $$declare t text;begin foreach t in array array['town_halls','town_hall_agenda','town_hall_options','town_hall_registrations','town_hall_hands','town_hall_contributions','town_hall_polls','town_hall_votes','safezone_reports','safezone_report_events','safezone_notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
end loop;end$$;
create policy sz_halls on public.town_halls for select to authenticated using(state<>'draft' or private.is_staff());
create policy sz_agenda on public.town_hall_agenda for select to authenticated using(exists(select 1 from public.town_halls h where h.id=town_hall_id and (h.state<>'draft' or private.is_staff())));
create policy sz_options on public.town_hall_options for select to authenticated using(exists(select 1 from public.town_halls h where h.id=town_hall_id and (h.state<>'draft' or private.is_staff())));
create policy sz_regs on public.town_hall_registrations for select to authenticated using(private.owns(household_id) or private.is_staff());
create policy sz_hands on public.town_hall_hands for select to authenticated using(private.is_staff() or exists(select 1 from public.child_profiles c where c.id=child_id and private.owns(c.household_id)));
create policy sz_contrib on public.town_hall_contributions for select to authenticated using(private.is_staff() or exists(select 1 from public.child_profiles c where c.id=child_id and private.owns(c.household_id)));
create policy sz_polls on public.town_hall_polls for select to authenticated using(private.is_staff() or (state<>'draft' and exists(select 1 from public.town_halls h where h.id=town_hall_id and h.state<>'draft')));
create policy sz_votes on public.town_hall_votes for select to authenticated using(exists(select 1 from public.child_profiles c where c.id=child_id and private.owns(c.household_id)));
create policy sz_reports on public.safezone_reports for select to authenticated using(private.owns(household_id) or private.is_staff());
-- Moderation notes are staff-only; families see status via their report row and notifications.
create policy sz_events on public.safezone_report_events for select to authenticated using(private.is_staff());
create policy sz_notes on public.safezone_notifications for select to authenticated using(private.owns(household_id));

create function private.sz_handle(hall uuid) returns text language plpgsql volatile set search_path='' as $$
declare colors text[]:=array['Teal','Amber','Coral','Indigo','Lime','Violet','Sky','Rose','Gold','Mint'];
 animals text[]:=array['Otter','Falcon','Panda','Lynx','Heron','Koala','Gecko','Orca','Badger','Robin']; h text;
begin
 loop
  h:=colors[1+floor(random()*10)::int]||' '||animals[1+floor(random()*10)::int]||' '||(1+floor(random()*99)::int);
  exit when not exists(select 1 from public.town_hall_registrations where town_hall_id=hall and handle=h);
 end loop;
 return h;
end$$;

create function private.sz_notify_hall(hall uuid, k text, msg text) returns void language sql security definer set search_path='' as $$
 insert into public.safezone_notifications(household_id,town_hall_id,child_id,kind,message)
 select r.household_id,hall,r.child_id,k,msg from public.town_hall_registrations r where r.town_hall_id=hall and r.status='registered'
$$;

create function private.sz_release(hall uuid, child uuid, new_status text, reason text) returns void language plpgsql security definer set search_path='' as $$begin
 update public.town_hall_registrations set status=new_status, withdrawn_at=case when new_status='withdrawn' then now() else withdrawn_at end, removed_reason=reason where town_hall_id=hall and child_id=child;
 update public.town_hall_hands set state='lowered' where town_hall_id=hall and child_id=child and state in ('waiting','speaking');
 update public.town_hall_contributions set status=case when new_status='withdrawn' then 'withdrawn' else 'rejected' end where town_hall_id=hall and child_id=child and (status='pending' or new_status='withdrawn');
 if new_status='withdrawn' then delete from public.town_hall_votes v using public.town_hall_polls p where p.id=v.poll_id and p.town_hall_id=hall and v.child_id=child; end if;
end$$;

create function private.safezone_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; staff boolean; admin boolean; h public.town_halls; c public.child_profiles; r public.town_hall_registrations;
 o public.town_hall_options; p public.town_hall_polls; rep public.safezone_reports; ref uuid; result jsonb:='{}'::jsonb; item jsonb; n int; newstate text; last_at timestamptz;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 staff:=private.is_staff(); admin:=private.is_staff('admin');
 select id into hid from public.households where guardian_id=uid;

 -- ---------- Moderator commands ----------
 if command in ('sz_hall_create','sz_hall_state','sz_agenda','sz_turn','sz_review','sz_poll_create','sz_poll_state','sz_remove','sz_emergency_close','sz_report_review') then
  if not staff then raise exception 'A SafeZone moderator role is required';end if;
  if command='sz_hall_create' then
   if jsonb_typeof(payload->'agenda') is distinct from 'array' or jsonb_array_length(payload->'agenda') not between 1 and 10
     or jsonb_typeof(payload->'options') is distinct from 'array' or jsonb_array_length(payload->'options') not between 1 and 60 then raise exception 'An agenda and moderator-written options are required';end if;
   insert into public.town_halls(title,summary,category,min_age,max_age,capacity,starts_at,duration_minutes,moderator_id,created_by)
   values(payload->>'title',payload->>'summary',payload->>'category',(payload->>'minAge')::int,(payload->>'maxAge')::int,(payload->>'capacity')::int,(payload->>'startsAt')::timestamptz,(payload->>'duration')::int,
     case when admin and payload ? 'moderator' then (payload->>'moderator')::uuid else uid end, uid) returning * into h;
   if not exists(select 1 from private.staff where user_id=h.moderator_id) then raise exception 'The assigned moderator must hold a staff role';end if;
   n:=0;
   for item in select * from jsonb_array_elements(payload->'agenda') loop
    n:=n+1; insert into public.town_hall_agenda values(h.id,n,item->>'title',(item->>'minutes')::int);
   end loop;
   n:=0;
   for item in select * from jsonb_array_elements(payload->'options') loop
    n:=n+1;
    if item->>'agenda' is not null and not exists(select 1 from public.town_hall_agenda where town_hall_id=h.id and ordinal=(item->>'agenda')::int) then raise exception 'Option refers to a missing agenda item';end if;
    insert into public.town_hall_options(town_hall_id,agenda_ordinal,kind,text,ordinal) values(h.id,(item->>'agenda')::int,item->>'kind',item->>'text',n);
   end loop;
   if not exists(select 1 from public.town_hall_options where town_hall_id=h.id and kind='contribution') then raise exception 'Add at least one statement card for speaking turns';end if;
   ref:=h.id; result:=jsonb_build_object('hall',h.id);
  elsif command in ('sz_review','sz_poll_state','sz_report_review') then
   if command='sz_review' then
    select h2.* into h from public.town_hall_contributions tc join public.town_halls h2 on h2.id=tc.town_hall_id where tc.id=(payload->>'contribution')::uuid for update of h2;
   elsif command='sz_poll_state' then
    select h2.* into h from public.town_hall_polls tp join public.town_halls h2 on h2.id=tp.town_hall_id where tp.id=(payload->>'poll')::uuid for update of h2;
   else
    select h2.* into h from public.safezone_reports sr join public.town_halls h2 on h2.id=sr.town_hall_id where sr.id=(payload->>'report')::uuid;
   end if;
   if h.id is null then raise exception 'Not found';end if;
  else
   select * into h from public.town_halls where id=(payload->>'hall')::uuid for update;
   if not found then raise exception 'Town hall not found';end if;
  end if;
  if command<>'sz_hall_create' and command<>'sz_report_review' and h.moderator_id<>uid and not admin then raise exception 'Only the assigned moderator can run this town hall';end if;
  ref:=coalesce(ref,h.id);

  if command='sz_hall_state' then
   newstate:=payload->>'state';
   if not ((h.state='draft' and newstate='scheduled') or (h.state='scheduled' and newstate='open') or (h.state='open' and newstate='active') or (h.state='active' and newstate='completed') or (h.state in ('draft','scheduled','open','active') and newstate='cancelled')) then raise exception 'This town hall cannot make that transition';end if;
   if newstate='scheduled' and h.starts_at<=now() then raise exception 'Schedule the town hall in the future';end if;
   update public.town_halls set state=newstate, completed_at=case when newstate='completed' then now() end, closed_reason=case when newstate='cancelled' then 'cancelled by moderator' end where id=h.id;
   if newstate in ('completed','cancelled') then
    update public.town_hall_polls set state='closed' where town_hall_id=h.id and state='open';
    update public.town_hall_hands set state='done' where town_hall_id=h.id and state in ('waiting','speaking');
   end if;
   if newstate='cancelled' then perform private.sz_notify_hall(h.id,'closed',format('The town hall "%s" was cancelled by its moderator.',h.title));end if;
  elsif command='sz_agenda' then
   if h.state<>'active' or not exists(select 1 from public.town_hall_agenda where town_hall_id=h.id and ordinal=(payload->>'item')::int) then raise exception 'Choose an agenda item in an active town hall';end if;
   update public.town_halls set current_item=(payload->>'item')::int where id=h.id;
   update public.town_hall_hands set state='done' where town_hall_id=h.id and state='speaking';
  elsif command='sz_turn' then
   if h.state<>'active' then raise exception 'The town hall is not active';end if;
   update public.town_hall_hands set state='done' where town_hall_id=h.id and state='speaking';
   if payload->>'hand' is not null then
    update public.town_hall_hands set state='speaking',granted_at=now() where id=(payload->>'hand')::uuid and town_hall_id=h.id and state='waiting';
    if not found then raise exception 'That hand is no longer raised';end if;
   end if;
  elsif command='sz_review' then
   update public.town_hall_contributions set status=case when (payload->>'approve')::boolean then 'approved' else 'rejected' end, reviewed_by=uid, reviewed_at=now()
    where id=(payload->>'contribution')::uuid and status='pending';
   if not found then raise exception 'This contribution was already reviewed';end if;
   ref:=(payload->>'contribution')::uuid;
  elsif command='sz_poll_create' then
   if h.state in ('completed','cancelled') then raise exception 'This town hall has ended';end if;
   if exists(select 1 from jsonb_array_elements(payload->'options') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 120) then raise exception 'Invalid poll option';end if;
   insert into public.town_hall_polls(town_hall_id,question,options) values(h.id,payload->>'question',payload->'options') returning id into ref;
   result:=jsonb_build_object('poll',ref);
  elsif command='sz_poll_state' then
   select * into p from public.town_hall_polls where id=(payload->>'poll')::uuid for update;
   if not ((p.state='draft' and payload->>'state'='open' and h.state='active') or (p.state='open' and payload->>'state'='closed')) then raise exception 'This poll cannot make that change';end if;
   update public.town_hall_polls set state=payload->>'state' where id=p.id; ref:=p.id;
  elsif command='sz_remove' then
   select * into r from public.town_hall_registrations where town_hall_id=h.id and handle=payload->>'handle' and status='registered' for update;
   if not found then raise exception 'Participant not found';end if;
   if length(coalesce(payload->>'reason','')) not between 3 and 300 then raise exception 'Record a reason for the removal';end if;
   perform private.sz_release(h.id,r.child_id,'removed',payload->>'reason');
   insert into public.safezone_reports(town_hall_id,household_id,reporter,handle,reason,severity,status) values(h.id,r.household_id,uid,r.handle,'removal','high','actioned') returning id into ref;
   insert into public.safezone_report_events(report_id,actor,status,note) values(ref,uid,'actioned',payload->>'reason');
   insert into public.safezone_notifications(household_id,town_hall_id,child_id,kind,message) values(r.household_id,h.id,r.child_id,'removed',format('Your explorer was removed from "%s" by the moderator. Reason: %s',h.title,payload->>'reason'));
  elsif command='sz_emergency_close' then
   if h.state in ('completed','cancelled') then raise exception 'This town hall has already ended';end if;
   if length(coalesce(payload->>'reason','')) not between 3 and 300 then raise exception 'Record a reason for the emergency closure';end if;
   update public.town_halls set state='cancelled', closed_reason='emergency: '||(payload->>'reason') where id=h.id;
   update public.town_hall_polls set state='closed' where town_hall_id=h.id and state='open';
   update public.town_hall_hands set state='done' where town_hall_id=h.id and state in ('waiting','speaking');
   insert into public.safezone_reports(town_hall_id,reporter,reason,severity,status) values(h.id,uid,'emergency','urgent','escalated') returning id into ref;
   insert into public.safezone_report_events(report_id,actor,status,note) values(ref,uid,'escalated',payload->>'reason');
   perform private.sz_notify_hall(h.id,'closed',format('The town hall "%s" was closed early by its moderator for safety. A safeguarding lead will review it.',h.title));
  elsif command='sz_report_review' then
   select * into rep from public.safezone_reports where id=(payload->>'report')::uuid for update;
   if rep.status in ('actioned','dismissed') then raise exception 'This report is already resolved';end if;
   if payload->>'status' not in ('under_review','actioned','dismissed','escalated') then raise exception 'Invalid report status';end if;
   update public.safezone_reports set status=payload->>'status' where id=rep.id;
   insert into public.safezone_report_events(report_id,actor,status,note) values(rep.id,uid,payload->>'status',left(payload->>'note',500));
   if rep.household_id is not null then
    insert into public.safezone_notifications(household_id,town_hall_id,kind,message) values(rep.household_id,rep.town_hall_id,'report_update',format('A SafeZone safety report you are linked to is now: %s.',replace(payload->>'status','_',' ')));
   end if;
   ref:=rep.id;
  end if;
  insert into public.audit_events(household_id,actor,action,reference_id,detail) values(null,uid,command,ref,'{}'::jsonb);
  return result;
 end if;

 -- ---------- Guardian commands ----------
 if not private.flag('safezone') then raise exception 'SafeZone is not open yet';end if;
 if hid is null then raise exception 'Create a household first';end if;

 if command='sz_permission' then
  if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Invalid SafeZone permission';end if;
  if (payload->>'enabled')::boolean then
   if not private.recent_reauth() then raise exception 'Confirm your guardian password to enable SafeZone';end if;
  else
   for r in select tr.* from public.town_hall_registrations tr join public.town_halls th on th.id=tr.town_hall_id where tr.household_id=hid and tr.status='registered' and th.state not in ('completed','cancelled') loop
    perform private.sz_release(r.town_hall_id,r.child_id,'withdrawn',null);
   end loop;
  end if;
  update public.guardian_permissions set safezone=(payload->>'enabled')::boolean where household_id=hid;
 elsif command='sz_report' then
  select * into h from public.town_halls where id=(payload->>'hall')::uuid;
  if not found or not exists(select 1 from public.town_hall_registrations where town_hall_id=h.id and household_id=hid) then raise exception 'Town hall not found or permission denied';end if;
  if payload->>'reason' not in ('bullying','unsafe','privacy','inappropriate','technical') then raise exception 'Choose a report reason';end if;
  if payload->>'contribution' is not null and not exists(select 1 from public.town_hall_contributions where id=(payload->>'contribution')::uuid and town_hall_id=h.id and status='approved') then raise exception 'Contribution not found';end if;
  if (select count(*) from public.safezone_reports where reporter=uid and created_at>now()-interval '1 hour')>=10 then raise exception 'Report limit reached. Contact support for urgent help';end if;
  insert into public.safezone_reports(town_hall_id,household_id,reporter,contribution_id,reason,severity)
   values(h.id,hid,uid,(payload->>'contribution')::uuid,payload->>'reason',case when payload->>'reason' in ('unsafe','bullying') then 'high' else 'low' end) returning id into ref;
  insert into public.safezone_report_events(report_id,actor,status) values(ref,uid,'open');
 else
  -- Child-scoped commands: the child must be this household's active explorer.
  select * into c from public.child_profiles where id=(payload->>'child')::uuid and household_id=hid and archived_at is null;
  if not found then raise exception 'Explorer not found or permission denied';end if;
  if command in ('sz_register','sz_withdraw','sz_hand','sz_say') then
   select * into h from public.town_halls where id=(payload->>'hall')::uuid and state<>'draft' for update;
   if not found then raise exception 'Town hall not found';end if;
  end if;
  if command='sz_register' then
   if not (select safezone from public.guardian_permissions where household_id=hid) then raise exception 'Enable SafeZone in your family permissions first';end if;
   if (payload->>'consent') is distinct from 'true' then raise exception 'Guardian consent is required for each town hall';end if;
   if not private.recent_reauth() then raise exception 'Confirm your guardian password to give consent';end if;
   select * into r from public.town_hall_registrations where town_hall_id=h.id and child_id=c.id;
   if r.status='removed' then raise exception 'A moderator removed this explorer from this town hall';end if;
   if r.status='registered' then raise exception 'Already registered';end if;
   if h.state not in ('scheduled','open') then raise exception 'Registration is closed for this town hall';end if;
   if c.age not between h.min_age and h.max_age then raise exception 'This town hall is for ages % to %',h.min_age,h.max_age;end if;
   if (select count(*) from public.town_hall_registrations where town_hall_id=h.id and status='registered')>=h.capacity then raise exception 'This town hall is full';end if;
   insert into public.town_hall_registrations(town_hall_id,child_id,household_id,handle) values(h.id,c.id,hid,private.sz_handle(h.id))
    on conflict(town_hall_id,child_id) do update set status='registered',consented_at=now(),withdrawn_at=null,handle=excluded.handle
    returning * into r;
   insert into public.safezone_notifications(household_id,town_hall_id,child_id,kind,message) values(hid,h.id,c.id,'registered',format('%s is registered for "%s" as %s.',c.nickname,h.title,r.handle));
   ref:=h.id; result:=jsonb_build_object('handle',r.handle);
  else
   select * into r from public.town_hall_registrations where town_hall_id=coalesce(h.id,(select town_hall_id from public.town_hall_polls where id=(payload->>'poll')::uuid)) and child_id=c.id;
   if command='sz_withdraw' then
    if r.status is distinct from 'registered' then raise exception 'This explorer is not registered';end if;
    perform private.sz_release(h.id,c.id,'withdrawn',null);
    insert into public.safezone_notifications(household_id,town_hall_id,child_id,kind,message) values(hid,h.id,c.id,'withdrawn',format('Consent withdrawn: %s left "%s" and their contributions and votes were removed.',c.nickname,h.title));
    ref:=h.id;
   else
    if r.status is distinct from 'registered' then raise exception 'Only registered explorers can take part';end if;
    if command='sz_vote' then
     select * into p from public.town_hall_polls where id=(payload->>'poll')::uuid;
     select * into h from public.town_halls where id=p.town_hall_id;
     if p.state<>'open' or h.state<>'active' then raise exception 'This poll is not open';end if;
     if (payload->>'choice')::int not between 0 and jsonb_array_length(p.options)-1 then raise exception 'Invalid choice';end if;
     insert into public.town_hall_votes(poll_id,child_id,choice) values(p.id,c.id,(payload->>'choice')::int) on conflict do nothing;
     if not found then raise exception 'This explorer already voted';end if;
     ref:=p.id;
    elsif h.state<>'active' then raise exception 'The town hall is not active';
    elsif command='sz_hand' then
     if jsonb_typeof(payload->'raised') is distinct from 'boolean' then raise exception 'Invalid hand request';end if;
     if (payload->>'raised')::boolean then
      insert into public.town_hall_hands(town_hall_id,child_id) values(h.id,c.id) on conflict do nothing;
     else
      update public.town_hall_hands set state='lowered' where town_hall_id=h.id and child_id=c.id and state in ('waiting','speaking');
     end if;
     ref:=h.id;
    elsif command='sz_say' then
     select * into o from public.town_hall_options where id=(payload->>'option')::uuid and town_hall_id=h.id;
     if not found then raise exception 'Choose one of this town hall''s cards';end if;
     if o.agenda_ordinal is not null and o.agenda_ordinal<>h.current_item then raise exception 'That card belongs to a different agenda item';end if;
     if o.kind='contribution' and not exists(select 1 from public.town_hall_hands where town_hall_id=h.id and child_id=c.id and state='speaking') then raise exception 'Wait for the moderator to give you a speaking turn';end if;
     select max(created_at),count(*) into last_at,n from public.town_hall_contributions where town_hall_id=h.id and child_id=c.id;
     if last_at>now()-interval '5 seconds' then raise exception 'Take a breath — try again in a few seconds';end if;
     if n>=20 then raise exception 'Contribution limit reached for this town hall';end if;
     insert into public.town_hall_contributions(town_hall_id,child_id,option_id) values(h.id,c.id,o.id) on conflict do nothing;
     if not found then raise exception 'You already shared that card';end if;
     ref:=h.id;
    else raise exception 'Unknown command';
    end if;
   end if;
  end if;
 end if;
 insert into public.audit_events(household_id,actor,action,reference_id) values(hid,uid,command,ref);
 return result;
end$$;
revoke all on function private.safezone_command(text,jsonb), private.sz_handle(uuid), private.sz_notify_hall(uuid,text,text), private.sz_release(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function private.safezone_command(text,jsonb) to authenticated;
revoke all on function private.flag(text), private.recent_reauth(integer) from public, anon;
grant execute on function private.flag(text), private.recent_reauth(integer) to authenticated;

create or replace function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select case
  when command in ('child_update','child_archive','child_delete','account_delete','export') then private.family_command(command,payload)
  when command like 'sz\_%' then private.safezone_command(command,payload)
  else private.command(command,payload) end
$$;

-- ---------- Sanitized reads ----------
-- Lobby: halls (no drafts unless staff), counts, this household's registrations and notifications.
create function private.safezone_lobby() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; staff boolean:=private.is_staff();
begin
 if uid is null then raise exception 'Please sign in';end if;
 select id into hid from public.households where guardian_id=uid;
 return jsonb_build_object(
  'enabled', private.flag('safezone'),
  'staff', staff,
  'permission', coalesce((select safezone from public.guardian_permissions where household_id=hid), false),
  'halls', coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title,'summary',h.summary,'category',h.category,'minAge',h.min_age,'maxAge',h.max_age,
     'capacity',h.capacity,'startsAt',h.starts_at,'duration',h.duration_minutes,'state',h.state,'closedReason',h.closed_reason,'mine',h.moderator_id=uid,
     'registered',(select count(*) from public.town_hall_registrations r where r.town_hall_id=h.id and r.status='registered'),
     'agenda',(select jsonb_agg(jsonb_build_object('ordinal',a.ordinal,'title',a.title,'minutes',a.minutes) order by a.ordinal) from public.town_hall_agenda a where a.town_hall_id=h.id))
    order by h.starts_at)
   from public.town_halls h where (h.state<>'draft' or staff) and (h.state not in ('completed','cancelled') or staff or exists(select 1 from public.town_hall_registrations r where r.town_hall_id=h.id and r.household_id=hid))), '[]'::jsonb),
  'registrations', coalesce((select jsonb_agg(jsonb_build_object('hall',r.town_hall_id,'child',r.child_id,'handle',r.handle,'status',r.status,'consentedAt',r.consented_at,'withdrawnAt',r.withdrawn_at,'removedReason',r.removed_reason))
   from public.town_hall_registrations r where r.household_id=hid), '[]'::jsonb),
  'notifications', coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'message',n.message,'createdAt',n.created_at) order by n.created_at desc)
   from (select * from public.safezone_notifications where household_id=hid order by created_at desc limit 30) n), '[]'::jsonb),
  'reports', case when staff then coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'hall',s.town_hall_id,'reason',s.reason,'severity',s.severity,'status',s.status,'handle',s.handle,'createdAt',s.created_at,
     'events',(select jsonb_agg(jsonb_build_object('status',e.status,'note',e.note,'at',e.created_at) order by e.created_at) from public.safezone_report_events e where e.report_id=s.id)) order by s.created_at desc)
   from public.safezone_reports s), '[]'::jsonb)
   else coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'hall',s.town_hall_id,'reason',s.reason,'status',s.status,'createdAt',s.created_at) order by s.created_at desc)
   from public.safezone_reports s where s.household_id=hid and s.reporter=uid), '[]'::jsonb) end);
end$$;

-- Room: one child's view (or the moderator's). Peers appear only as handles;
-- questions are anonymous; nicknames, household ids and child ids never leave.
create function private.safezone_room(hall uuid, child uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); h public.town_halls; r public.town_hall_registrations; mod boolean; me jsonb:=null;
begin
 select * into h from public.town_halls where id=hall;
 if not found then raise exception 'Town hall not found';end if;
 mod:=private.is_staff() and (h.moderator_id=uid or private.is_staff('admin'));
 if not mod then
  select tr.* into r from public.town_hall_registrations tr join public.households hh on hh.id=tr.household_id where tr.town_hall_id=hall and tr.child_id=child and hh.guardian_id=uid;
  if not found then raise exception 'Register with guardian consent to join this town hall';end if;
  if r.status<>'registered' then
   return jsonb_build_object('hall',jsonb_build_object('id',h.id,'title',h.title,'state',h.state),'me',jsonb_build_object('status',r.status,'handle',r.handle,'removedReason',r.removed_reason));
  end if;
  me:=jsonb_build_object('status',r.status,'handle',r.handle,
   'hand',(select state from public.town_hall_hands where town_hall_id=hall and child_id=child and state in ('waiting','speaking')),
   'shared',coalesce((select jsonb_agg(jsonb_build_object('option',tc.option_id,'status',tc.status)) from public.town_hall_contributions tc where tc.town_hall_id=hall and tc.child_id=child),'[]'::jsonb),
   'votes',coalesce((select jsonb_object_agg(v.poll_id,v.choice) from public.town_hall_votes v join public.town_hall_polls p on p.id=v.poll_id where p.town_hall_id=hall and v.child_id=child),'{}'::jsonb));
 end if;
 return jsonb_build_object(
  'serverNow', now(),
  'moderator', mod,
  'hall', jsonb_build_object('id',h.id,'title',h.title,'summary',h.summary,'state',h.state,'currentItem',h.current_item,'startsAt',h.starts_at,'duration',h.duration_minutes,'closedReason',h.closed_reason,'minAge',h.min_age,'maxAge',h.max_age),
  'agenda', (select jsonb_agg(jsonb_build_object('ordinal',a.ordinal,'title',a.title,'minutes',a.minutes) order by a.ordinal) from public.town_hall_agenda a where a.town_hall_id=hall),
  'options', coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'text',o.text,'agenda',o.agenda_ordinal) order by o.ordinal) from public.town_hall_options o where o.town_hall_id=hall),'[]'::jsonb),
  'me', me,
  'participants', (select count(*) from public.town_hall_registrations where town_hall_id=hall and status='registered'),
  'queue', coalesce((select jsonb_agg(jsonb_build_object('hand',case when mod then hh.id end,'handle',tr.handle,'state',hh.state) order by hh.raised_at)
    from public.town_hall_hands hh join public.town_hall_registrations tr on tr.town_hall_id=hh.town_hall_id and tr.child_id=hh.child_id where hh.town_hall_id=hall and hh.state in ('waiting','speaking')),'[]'::jsonb),
  'feed', coalesce((select jsonb_agg(jsonb_build_object('id',tc.id,'kind',o.kind,'text',o.text,'agenda',o.agenda_ordinal,'handle',case when o.kind='question' then null else tr.handle end,'at',tc.reviewed_at) order by tc.reviewed_at)
    from public.town_hall_contributions tc join public.town_hall_options o on o.id=tc.option_id join public.town_hall_registrations tr on tr.town_hall_id=tc.town_hall_id and tr.child_id=tc.child_id
    where tc.town_hall_id=hall and tc.status='approved'),'[]'::jsonb),
  'pending', case when mod then coalesce((select jsonb_agg(jsonb_build_object('id',tc.id,'kind',o.kind,'text',o.text,'handle',tr.handle,'at',tc.created_at) order by tc.created_at)
    from public.town_hall_contributions tc join public.town_hall_options o on o.id=tc.option_id join public.town_hall_registrations tr on tr.town_hall_id=tc.town_hall_id and tr.child_id=tc.child_id
    where tc.town_hall_id=hall and tc.status='pending'),'[]'::jsonb) end,
  'roster', case when mod then coalesce((select jsonb_agg(jsonb_build_object('handle',tr.handle,'status',tr.status) order by tr.handle) from public.town_hall_registrations tr where tr.town_hall_id=hall),'[]'::jsonb) end,
  'polls', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'question',p.question,'options',p.options,'state',p.state,
     'votes',(select count(*) from public.town_hall_votes v where v.poll_id=p.id),
     'results',case when p.state='closed' or mod then (select jsonb_agg((select count(*) from public.town_hall_votes v where v.poll_id=p.id and v.choice=i)) from generate_series(0,jsonb_array_length(p.options)-1) i) end) order by p.created_at)
    from public.town_hall_polls p where p.town_hall_id=hall and (p.state<>'draft' or mod)),'[]'::jsonb),
  'summary', case when h.state='completed' then jsonb_build_object(
     'participants',(select count(*) from public.town_hall_registrations where town_hall_id=hall and status='registered'),
     'ideas',coalesce((select jsonb_agg(jsonb_build_object('text',x.text,'supporters',x.n) order by x.n desc) from (select o.text,count(*) n from public.town_hall_contributions tc join public.town_hall_options o on o.id=tc.option_id where tc.town_hall_id=hall and tc.status='approved' and o.kind='idea' group by o.text) x),'[]'::jsonb),
     'contributions',(select count(*) from public.town_hall_contributions where town_hall_id=hall and status='approved')) end);
end$$;
revoke all on function private.safezone_lobby(), private.safezone_room(uuid,uuid) from public, anon;
grant execute on function private.safezone_lobby(), private.safezone_room(uuid,uuid) to authenticated;
create function public.qz_safezone_lobby() returns jsonb language sql stable security invoker set search_path='' as $$select private.safezone_lobby()$$;
create function public.qz_safezone_room(hall uuid, child uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select private.safezone_room(hall, child)$$;
revoke all on function public.qz_safezone_lobby(), public.qz_safezone_room(uuid,uuid) from public, anon;
grant execute on function public.qz_safezone_lobby(), public.qz_safezone_room(uuid,uuid) to authenticated;
