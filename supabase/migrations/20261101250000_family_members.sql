-- QZ-31: adult family members on their own devices (additive).
-- The guardian stays the one accountable adult (FAMILY.md §1). A member is an adult the
-- guardian invites with a single-use, expiring code. Members can host and play household
-- games on their own device; only the guardian manages explorers, permissions, consent,
-- hint limits, SafeZone, export, invitations, and deletion. Children still have no accounts.
create table public.household_members(
 household_id uuid not null references public.households on delete cascade,
 user_id uuid not null unique references auth.users(id) on delete cascade,
 display_name text not null check (display_name ~ '^[[:alnum:] _-]{2,24}$'),
 joined_at timestamptz not null default now(),
 primary key (household_id, user_id));
-- Only a hash of each code is stored; the code itself is shown to the guardian once.
create table public.household_invites(
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households on delete cascade,
 code_hash text not null unique,
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '72 hours',
 used_by uuid references auth.users(id) on delete set null,
 used_at timestamptz,
 revoked_at timestamptz);
create index invites_household on public.household_invites(household_id);
-- Which adult devices have a game open (presence for the lobby). Not readable directly.
create table public.session_devices(
 session_id uuid not null references public.game_sessions on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null,
 last_seen timestamptz not null default now(),
 primary key (session_id, user_id));
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.session_devices enable row level security;
revoke all on public.household_members, public.household_invites, public.session_devices from anon, authenticated;
grant select on public.household_members to authenticated;
grant select (id, household_id, created_at, expires_at, used_at, revoked_at) on public.household_invites to authenticated;

-- A user is a guardian of one household or a member of one, never both.
create function private.one_household_role() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_TABLE_NAME='households' then
  if exists(select 1 from public.household_members where user_id=NEW.guardian_id) then raise exception 'You already belong to a household';end if;
 elsif exists(select 1 from public.households where guardian_id=NEW.user_id) then raise exception 'A guardian account already has its own household';
 end if;
 return NEW;
end$$;
create trigger households_one_role before insert on public.households for each row execute function private.one_household_role();
create trigger members_one_role before insert on public.household_members for each row execute function private.one_household_role();

-- Guardian or member. private.owns stays guardian-only for guardian-only data.
create function private.member_of(h uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.households where id=h and guardian_id=(select auth.uid()))
  or exists(select 1 from public.household_members where household_id=h and user_id=(select auth.uid()))$$;
create or replace function private.owns_session(s uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.game_sessions where id=s and private.member_of(household_id))$$;
revoke all on function private.member_of(uuid), private.one_household_role() from public, anon, authenticated;
grant execute on function private.member_of(uuid) to authenticated;

create policy household_members_read on public.household_members for select to authenticated using(private.member_of(household_id));
create policy household_invites_read on public.household_invites for select to authenticated using(private.owns(household_id));

-- Play-related reads widen to members. Guardian-only: reports, audit, consent, SafeZone, invites.
drop policy own_household on public.households;
create policy own_household on public.households for select to authenticated using(private.member_of(id));
drop policy own_permissions on public.guardian_permissions;
create policy own_permissions on public.guardian_permissions for select to authenticated using(private.member_of(household_id));
drop policy own_children on public.child_profiles;
create policy own_children on public.child_profiles for select to authenticated using(private.member_of(household_id));
drop policy own_sessions on public.game_sessions;
create policy own_sessions on public.game_sessions for select to authenticated using(private.member_of(household_id));
drop policy own_nights on public.game_nights;
create policy own_nights on public.game_nights for select to authenticated using(private.member_of(household_id));
drop policy content_versions on public.challenge_versions;
create policy content_versions on public.challenge_versions for select to authenticated using(status='published' or private.is_staff('admin') or exists(select 1 from public.game_sessions s where s.challenge_version_id=challenge_versions.id and private.member_of(s.household_id)));
drop policy content_steps on public.challenge_steps;
create policy content_steps on public.challenge_steps for select to authenticated using(exists(select 1 from public.challenge_versions v where v.id=version_id and (v.status='published' or private.is_staff('admin') or exists(select 1 from public.game_sessions s where s.challenge_version_id=v.id and private.member_of(s.household_id)))));
drop policy content_challenges on public.challenges;
create policy content_challenges on public.challenges for select to authenticated using(
 private.is_staff('admin')
 or exists(select 1 from public.challenge_versions v where v.challenge_id=challenges.id and v.status='published')
 or exists(select 1 from public.game_sessions s join public.challenge_versions v on v.id=s.challenge_version_id where v.challenge_id=challenges.id and private.member_of(s.household_id))
);
drop policy own_child_badges on public.child_badges;
create policy own_child_badges on public.child_badges for select to authenticated
 using(exists(select 1 from public.child_profiles c where c.id=child_id and private.member_of(c.household_id)));
drop policy own_household_badges on public.household_badges;
create policy own_household_badges on public.household_badges for select to authenticated using(private.member_of(household_id));

-- Practice can be started by whoever hosts the game.
create or replace function private.mark_practice(sid uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.game_sessions set practice=true
  where id=sid and state='lobby' and private.member_of(household_id)
   and not exists(select 1 from public.player_answers where session_id=sid);
 if not found then raise exception 'Session not found or permission denied';end if;
end$$;

-- Hint usage is visible to everyone who can play.
create or replace function private.q_usage() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'used', (select count(*) from public.ai_evaluations e where e.household_id=h.id and e.created_at > now()-interval '24 hours'),
  'limit', (select q_daily_limit from public.guardian_permissions where household_id=h.id))
 from public.households h where private.member_of(h.id)
$$;

-- The caller's household and role, resolved explicitly from auth.uid().
create function private.my_household() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',h.id,'name',h.name,
  'role',case when h.guardian_id=(select auth.uid()) then 'guardian' else 'member' end,
  'displayName',m.display_name)
 from public.households h left join public.household_members m on m.household_id=h.id and m.user_id=(select auth.uid())
 where h.guardian_id=(select auth.uid()) or m.user_id is not null
 limit 1$$;
revoke all on function private.my_household() from public, anon, authenticated;
grant execute on function private.my_household() to authenticated;
create function public.qz_household() returns jsonb language sql stable security invoker set search_path='' as $$select private.my_household()$$;
revoke all on function public.qz_household() from public, anon;
grant execute on function public.qz_household() to authenticated;

create function private.member_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; code text; inv public.household_invites; ref uuid; dname text; result jsonb:='{}'::jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed account is required';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 select id into hid from public.households where guardian_id=uid;
 if command='member_join' then
  perform private.rate_limit('member_join', 10, 3600);
  if hid is not null then raise exception 'A guardian account already has its own household';end if;
  if exists(select 1 from public.household_members where user_id=uid) then raise exception 'You already belong to a household';end if;
  dname:=trim(payload->>'displayName');
  if dname is null or dname !~ '^[[:alnum:] _-]{2,24}$' then raise exception 'Choose a display name of 2 to 24 letters or numbers';end if;
  code:=upper(regexp_replace(coalesce(payload->>'code',''),'[^A-Za-z0-9]','','g'));
  select * into inv from public.household_invites where code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') for update;
  -- A wrong code returns instead of raising so this call commits and its rate-limit hit
  -- sticks (a raise would roll the hit back and leave guessing unmetered).
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at<=now() then return jsonb_build_object('joined',false);end if;
  perform 1 from public.households where id=inv.household_id for update;
  if (select count(*) from public.household_members where household_id=inv.household_id)>=4 then raise exception 'This household already has four family members';end if;
  insert into public.household_members(household_id,user_id,display_name) values(inv.household_id,uid,dname);
  update public.household_invites set used_by=uid,used_at=now() where id=inv.id;
  hid:=inv.household_id;ref:=inv.id;result:=jsonb_build_object('joined',true);
 elsif command='member_leave' then
  select household_id into hid from public.household_members where user_id=uid;
  if hid is null then raise exception 'You are not a member of a household';end if;
  delete from public.session_devices where user_id=uid;
  delete from public.household_members where user_id=uid;
  ref:=uid;
 else
  if hid is null then raise exception 'Only the guardian can manage family members';end if;
  if command='member_invite' then
   perform 1 from public.households where id=hid for update;
   if (select count(*) from public.household_members where household_id=hid)>=4 then raise exception 'A household supports up to four family members';end if;
   if (select count(*) from public.household_invites where household_id=hid and used_at is null and revoked_at is null and expires_at>now())>=3 then raise exception 'Revoke an unused invite first';end if;
   -- 12 hex characters from the CSPRNG behind gen_random_uuid (the version nibble comes after them).
   code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
   insert into public.household_invites(household_id,code_hash,created_by) values(hid,encode(sha256(convert_to(code,'UTF8')),'hex'),uid) returning id into ref;
   result:=jsonb_build_object('id',ref,'code',substr(code,1,4)||'-'||substr(code,5,4)||'-'||substr(code,9,4),
    'expiresAt',(select expires_at from public.household_invites where id=ref));
  elsif command='member_uninvite' then
   update public.household_invites set revoked_at=now() where id=(payload->>'invite')::uuid and household_id=hid and used_at is null and revoked_at is null returning id into ref;
   if ref is null then raise exception 'Invite not found or already used';end if;
  elsif command='member_remove' then
   delete from public.household_members where household_id=hid and user_id=(payload->>'member')::uuid returning user_id into ref;
   if ref is null then raise exception 'Family member not found';end if;
   delete from public.session_devices where user_id=ref;
  else raise exception 'Unknown command';
  end if;
 end if;
 insert into public.audit_events(household_id,actor,action,reference_id) values(hid,uid,command,ref);
 return result;
end$$;

-- Lobby presence: which adults have this game open. Labels only, never account ids.
create function private.presence(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid; lbl text;
begin
 if uid is null then raise exception 'Sign in first';end if;
 sid:=(payload->>'session')::uuid;
 if sid is null or not private.owns_session(sid) then raise exception 'Session not found or permission denied';end if;
 select case when h.guardian_id=uid then 'Guardian' else m.display_name end into lbl
  from public.game_sessions s join public.households h on h.id=s.household_id
  left join public.household_members m on m.household_id=h.id and m.user_id=uid where s.id=sid;
 insert into public.session_devices(session_id,user_id,label) values(sid,uid,lbl)
  on conflict (session_id,user_id) do update set last_seen=now(),label=excluded.label;
 return jsonb_build_object('devices',coalesce((select jsonb_agg(jsonb_build_object('label',d.label,'you',d.user_id=uid) order by d.label)
  from public.session_devices d where d.session_id=sid and d.last_seen>now()-interval '30 seconds'),'[]'::jsonb));
end$$;

-- A member deleting their account: drop their reports (the guardian path does the same
-- for the guardian's own) so the reporter reference doesn't block deletion.
create function private.member_offboard() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if exists(select 1 from public.household_members where user_id=uid) then
  delete from public.moderation_cases where reporter=uid;
 end if;
end$$;
revoke all on function private.member_command(text,jsonb), private.presence(jsonb), private.member_offboard() from public, anon, authenticated;
grant execute on function private.member_command(text,jsonb), private.presence(jsonb), private.member_offboard() to authenticated;

-- Members resolve to their household in the core command; child and permission changes stay guardian-only.
create or replace function private.command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; sid uuid; vid uuid; cid uuid; st public.game_sessions; v public.challenge_versions; step public.challenge_steps; k private.answer_keys; pts int; n int; total int; result jsonb:='{}'; mode_name text; ref uuid; textout text; newstate text; plan_total int; allocation jsonb; is_member boolean:=false;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 select id into hid from public.households where guardian_id=uid;
 if hid is null then select household_id into hid from public.household_members where user_id=uid; is_member:=hid is not null; end if;
 if command='household' then
  if hid is not null then raise exception 'Household already exists';end if;
  if (payload->>'consent') is distinct from 'true' or payload->>'name' is null or length(trim(payload->>'name')) not between 2 and 50 then raise exception 'Guardian consent and a household name are required';end if;
  insert into public.households(guardian_id,name) values(uid,trim(payload->>'name')) returning id into hid;
  insert into public.guardian_permissions(household_id) values(hid);
 elsif command='draft' or command='publish' or command='review' then
  if not private.is_staff(case when command='review' then null else 'admin' end) then raise exception 'Permission denied';end if;
  if command='draft' then
   if not (payload ?& array['mode','title','scenario','prompt','options','correct','hint','explanation']) or jsonb_typeof(payload->'options') is distinct from 'array' or payload->>'mode' not in ('quick','solve','build','debate','world') or length(payload->>'title') not between 4 and 100 or length(payload->>'scenario') not between 20 and 1000 or length(payload->>'prompt') not between 10 and 500 or jsonb_array_length(payload->'options') not between 2 and 6 or (payload->>'correct')::int not between 0 and jsonb_array_length(payload->'options')-1 or length(payload->>'hint') not between 10 and 300 or length(payload->>'explanation') not between 10 and 500 then raise exception 'Invalid challenge content';end if;
   if exists(select 1 from jsonb_array_elements(payload->'options') o where jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 150) then raise exception 'Invalid answer option';end if;
   insert into public.challenges(title,mode,description) values(payload->>'title',payload->>'mode',payload->>'scenario') returning id into cid;
   insert into public.challenge_versions(challenge_id,scenario) values(cid,payload->>'scenario') returning id into vid;
   insert into public.challenge_steps(version_id,ordinal,prompt,options,hint) values(vid,1,payload->>'prompt',payload->'options',payload->>'hint') returning id into sid;
   insert into private.answer_keys values(sid,(payload->>'correct')::int,payload->>'explanation');ref:=vid;
  elsif command='publish' then
   if (payload->>'ageReviewed') is distinct from 'true' then raise exception 'Age review is required';end if;
   select * into v from public.challenge_versions where id=(payload->>'version')::uuid for update;
   if not found or v.status not in ('draft','review') or not exists(select 1 from public.challenge_steps where version_id=v.id) then raise exception 'Version cannot be published';end if;
   update public.challenge_versions set status='published',age_reviewed=true where id=v.id;ref:=v.id;
  else
   select id into ref from public.moderation_cases where id=(payload->>'caseId')::uuid for update;
   if ref is null or payload->>'status' not in ('under_review','actioned','dismissed','escalated') then raise exception 'Invalid review';end if;
   if exists(select 1 from public.moderation_cases where id=ref and status in ('actioned','dismissed')) then raise exception 'Case already resolved';end if;
   update public.moderation_cases set status=payload->>'status' where id=ref;
  end if;
 elsif hid is null then raise exception 'Create a household first';
 elsif is_member and command in ('child','permissions') then raise exception 'Only the guardian can change this';
 elsif command='child' then
  perform 1 from public.households where id=hid for update;
  if (select count(*) from public.child_profiles where household_id=hid)>=8 then raise exception 'A household supports up to eight child profiles';end if;
  if (payload->>'nickname') !~ '^[[:alnum:] _-]{2,24}$' then raise exception 'Use a nickname without personal contact details';end if;
  insert into public.child_profiles(household_id,nickname,age,avatar,interest) values(hid,trim(payload->>'nickname'),(payload->>'age')::int,payload->>'avatar',payload->>'interest') returning id into ref;
 elsif command='permissions' then
  if jsonb_typeof(payload->'world') is distinct from 'boolean' or jsonb_typeof(payload->'q') is distinct from 'boolean' or payload->>'minutes' is null then raise exception 'Invalid guardian permissions';end if;
  update public.guardian_permissions set world=(payload->>'world')::boolean,q=(payload->>'q')::boolean,minutes=(payload->>'minutes')::int where household_id=hid;
 elsif command='schedule' then
  if (payload->>'at')::timestamptz<=now() or (payload->>'at')::timestamptz>now()+interval '366 days' then raise exception 'Choose a date within the next year';end if;
  insert into public.game_nights(household_id,scheduled_at,mode) values(hid,(payload->>'at')::timestamptz,payload->>'mode') returning id into ref;
 elsif command='create' then
  perform 1 from public.households where id=hid for update;
  if (select count(*) from public.game_sessions where household_id=hid and state in ('lobby','ready','active','paused') and expires_at>now())>=3 then raise exception 'Finish or cancel an existing adventure first';end if;
  select cv.* into v from public.challenge_versions cv where cv.challenge_id=(payload->>'challenge')::uuid and cv.status='published' and cv.age_reviewed order by version desc limit 1;
  if not found then raise exception 'Challenge unavailable';end if;
  select mode into mode_name from public.challenges where id=v.challenge_id;
  if mode_name='world' and not (select world from public.guardian_permissions where household_id=hid) then raise exception 'A guardian must enable WorldZone first';end if;
  if payload->'children' is null or jsonb_typeof(payload->'children')<>'array' or jsonb_array_length(payload->'children') not between 1 and 8 then raise exception 'Choose your players';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'children') x where not exists(select 1 from public.child_profiles c where c.id=x::uuid and c.household_id=hid and c.age between v.min_age and v.max_age)) then raise exception 'Player is not eligible for this challenge';end if;
  insert into public.game_sessions(household_id,challenge_version_id,expires_at) values(hid,v.id,now()+make_interval(mins=>(select minutes from public.guardian_permissions where household_id=hid))) returning id into sid;
  insert into public.session_players select sid,x::uuid from jsonb_array_elements_text(payload->'children') x;ref:=sid;result:=jsonb_build_object('session',sid);
 elsif command in ('transition','answer','plan','blueprint','hint','report') then
  select * into st from public.game_sessions where id=(payload->>'session')::uuid and household_id=hid for update;
  if not found then raise exception 'Session not found or permission denied';end if;sid:=st.id;ref:=sid;
  if command='report' then
   insert into public.moderation_cases(household_id,session_id,reporter,reason) values(hid,sid,uid,payload->>'reason') on conflict(session_id,reporter,reason) do nothing;
  elsif st.expires_at<=now() and st.state not in ('complete','cancelled','expired') then
   update public.game_sessions set state='expired' where id=sid;
   result:=jsonb_build_object('expired',true);
  elsif command='transition' then
   newstate:=payload->>'state';
   if not ((st.state='lobby' and newstate='ready') or (st.state='ready' and newstate='active') or (st.state='active' and newstate='paused') or (st.state='paused' and newstate='active') or (st.state in ('lobby','ready','active','paused') and newstate='cancelled')) then raise exception 'This session cannot make that transition';end if;
   update public.game_sessions set state=newstate where id=sid;
  elsif command='hint' then
   if st.state<>'active' or not (select q from public.guardian_permissions where household_id=hid) then raise exception 'Guided hints are unavailable';end if;
   if (select count(*) from public.ai_evaluations where session_id=sid)>=10 then raise exception 'Hint limit reached for this session';end if;
   select s.hint into textout from public.challenge_steps s where version_id=st.challenge_version_id and not exists(select 1 from public.player_answers a where a.session_id=sid and a.step_id=s.id) order by ordinal limit 1;
   if textout is null then raise exception 'No remaining hints';end if;
   insert into public.ai_evaluations(session_id,output) values(sid,textout);result:=jsonb_build_object('hint',textout,'provider','curated');
  else
   if st.state<>'active' then raise exception 'Start or resume the session first';end if;
   select * into step from public.challenge_steps where version_id=st.challenge_version_id and not exists(select 1 from public.player_answers a where a.session_id=sid and a.step_id=public.challenge_steps.id) order by ordinal limit 1;
   if step.id is null or step.id<>(payload->>'step')::uuid then raise exception 'Answer the current step only';end if;
   select * into k from private.answer_keys where step_id=step.id;
   if not found then raise exception 'Challenge scoring is unavailable';end if;
   if step.kind='blueprint' then
    if command<>'blueprint' then raise exception 'Submit your shelter design for this step';end if;
    allocation:=payload->'design';
    if allocation is null or jsonb_typeof(allocation)<>'object' or not (allocation ?& array['roof','access','seating','lighting','mural']) or (select count(*) from jsonb_object_keys(allocation))<>5 then raise exception 'Provide all design choices';end if;
    if exists(select 1 from jsonb_each(allocation) a where jsonb_typeof(a.value)<>'boolean') then raise exception 'Invalid design choice';end if;
    plan_total:=case when (allocation->>'roof')::boolean then 4000 else 0 end+case when (allocation->>'access')::boolean then 2500 else 0 end+case when (allocation->>'seating')::boolean then 2000 else 0 end+case when (allocation->>'lighting')::boolean then 1500 else 0 end+case when (allocation->>'mural')::boolean then 2000 else 0 end;
    if plan_total not between 1 and 10000 then raise exception 'Keep your shelter design within $10,000';end if;
    pts:=25+case when (allocation->>'roof')::boolean then 25 else 0 end+case when (allocation->>'access')::boolean then 25 else 0 end+case when (allocation->>'seating')::boolean then 25 else 0 end;
    insert into public.build_submissions values(sid,(allocation->>'roof')::boolean,(allocation->>'access')::boolean,(allocation->>'seating')::boolean,(allocation->>'lighting')::boolean,(allocation->>'mural')::boolean,plan_total);
    textout:=format('Your shelter plan costs $%s and leaves $%s. Explain how your choices address weather, accessibility, and comfort. Compare the tradeoffs before pitching your idea.',plan_total,10000-plan_total);
    insert into public.player_answers(session_id,step_id,design,points,feedback) values(sid,step.id,allocation,pts,textout);
   elsif step.kind='allocation' then
    if command<>'plan' then raise exception 'Submit a budget allocation for this step';end if;
    allocation:=payload->'allocation';
    if allocation is null or jsonb_typeof(allocation)<>'object' or not (allocation ?& array['solar','wind','battery','diesel','grid','efficiency']) or (select count(*) from jsonb_object_keys(allocation))<>6 then raise exception 'Provide all six budget allocations';end if;
    if exists(select 1 from jsonb_each(allocation) a where jsonb_typeof(a.value)<>'number' or (a.value::text)::numeric not between 0 and 100000 or (a.value::text)::numeric<>trunc((a.value::text)::numeric)) then raise exception 'Allocations must be whole dollars between 0 and 100000';end if;
    select sum((value::text)::int) into plan_total from jsonb_each(allocation);
    if plan_total>100000 or plan_total=0 then raise exception 'Your plan must allocate between $1 and $100,000';end if;
    pts:=25+case when (allocation->>'battery')::int>=20000 then 25 else 0 end+case when (allocation->>'solar')::int+(allocation->>'wind')::int>=35000 then 25 else 0 end+case when (allocation->>'efficiency')::int>=10000 then 25 else 0 end;
    textout:=format('Your team allocated $%s, leaving $%s. Discuss how storage supports reliability, renewables reduce fuel dependence, and efficiency reduces demand. This is a simplified learning scenario, not an engineering recommendation.',plan_total,100000-plan_total);
    insert into public.player_answers(session_id,step_id,allocation,points,feedback) values(sid,step.id,allocation,pts,textout);
   else
    if command<>'answer' or payload->>'choice' is null or (payload->>'choice')::int not between 0 and jsonb_array_length(step.options)-1 then raise exception 'Invalid choice';end if;
    pts:=case when (payload->>'choice')::int=k.correct then 100 else 25 end;
    insert into public.player_answers(session_id,step_id,choice,points,feedback) values(sid,step.id,(payload->>'choice')::int,pts,k.explanation);
   end if;
   update public.game_sessions set total_score=total_score+pts where id=sid;
   select count(*) into n from public.challenge_steps where version_id=st.challenge_version_id;
   select count(*),sum(points) into total,pts from public.player_answers where session_id=sid;
   if n=total then
    update public.game_sessions set state='complete',completed_at=now() where id=sid;
    select c.mode into mode_name from public.challenges c join public.challenge_versions cv on cv.challenge_id=c.id where cv.id=st.challenge_version_id;
    insert into public.score_events(session_id,child_id,points,skill) select sid,p.child_id,pts,case mode_name when 'quick' then 'Scientific reasoning' when 'solve' then 'Systems thinking' when 'build' then 'Creativity' when 'debate' then 'Communication' else 'Global perspectives' end from public.session_players p where p.session_id=sid;
    insert into public.passport_entries(session_id,child_id,country) select sid,p.child_id,c.country from public.session_players p join public.challenge_versions cv on cv.id=st.challenge_version_id join public.challenges c on c.id=cv.challenge_id where p.session_id=sid and c.country is not null;
   end if;
  end if;
 else raise exception 'Unknown command';end if;
 insert into public.audit_events(household_id,actor,action,reference_id,detail) values(hid,uid,command,ref,case when command='review' then jsonb_build_object('status',payload->>'status') else '{}'::jsonb end);
 return result;
end$$;revoke all on function private.command(text,jsonb) from public;
grant execute on function private.command(text,jsonb) to authenticated;

create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
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
 end if;
 return private.command(command,payload);
end$$;
