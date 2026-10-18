-- QuiZone pilot: guardian-led shared-screen sessions. No independent child login.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.households(id uuid primary key default gen_random_uuid(),guardian_id uuid not null unique references auth.users(id) on delete cascade,name text not null check(length(name) between 2 and 50),consented_at timestamptz not null default now(),created_at timestamptz not null default now());
create table public.guardian_permissions(household_id uuid primary key references public.households on delete cascade,world boolean not null default false,q boolean not null default false,minutes integer not null default 30 check(minutes between 5 and 120));
create table public.child_profiles(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households on delete cascade,nickname text not null check(length(nickname) between 2 and 24),age integer not null check(age between 8 and 17),avatar text not null check(avatar in ('fox','panda','owl','rocket')),interest text not null check(interest in ('science','nature','creativity','world')),created_at timestamptz not null default now());
create table public.challenges(id uuid primary key default gen_random_uuid(),title text not null,mode text not null check(mode in ('quick','solve','build','debate','world')),description text not null,minutes integer not null default 15 check(minutes between 1 and 120),country text);
create table public.challenge_versions(id uuid primary key default gen_random_uuid(),challenge_id uuid not null references public.challenges,version integer not null default 1,status text not null default 'draft' check(status in ('draft','review','published','retired')),scenario text not null,min_age integer not null default 8,max_age integer not null default 17,age_reviewed boolean not null default false,created_at timestamptz not null default now(),unique(challenge_id,version),check(min_age>=8 and max_age<=17 and min_age<=max_age));
create table public.challenge_steps(id uuid primary key default gen_random_uuid(),version_id uuid not null references public.challenge_versions,ordinal integer not null,kind text not null default 'choice' check(kind in ('choice','allocation','blueprint')),prompt text not null,options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),hint text not null,unique(version_id,ordinal));
create table private.answer_keys(step_id uuid primary key references public.challenge_steps,correct integer not null check(correct between 0 and 5),explanation text not null);
create table public.game_sessions(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,challenge_version_id uuid not null references public.challenge_versions,code text not null unique default ('QZ-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),state text not null default 'lobby' check(state in ('lobby','ready','active','paused','complete','cancelled','expired')),created_at timestamptz not null default now(),expires_at timestamptz not null,completed_at timestamptz,total_score integer not null default 0);
create table public.session_players(session_id uuid not null references public.game_sessions,child_id uuid not null references public.child_profiles,primary key(session_id,child_id));
create table public.player_answers(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions,step_id uuid not null references public.challenge_steps,choice integer,allocation jsonb,design jsonb,points integer not null,feedback text not null,created_at timestamptz not null default now(),unique(session_id,step_id));
create table public.build_submissions(session_id uuid primary key references public.game_sessions,roof boolean not null,access boolean not null,seating boolean not null,lighting boolean not null,mural boolean not null,total_cost integer not null check(total_cost between 1 and 10000));
create table public.score_events(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions,child_id uuid not null references public.child_profiles,points integer not null,skill text not null,created_at timestamptz not null default now(),unique(session_id,child_id));
create table public.passport_entries(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions,child_id uuid not null references public.child_profiles,country text not null,created_at timestamptz not null default now(),unique(session_id,child_id));
create table public.moderation_cases(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,session_id uuid not null references public.game_sessions,reporter uuid not null references auth.users,reason text not null check(reason in ('inappropriate','incorrect','technical','privacy')),status text not null default 'open' check(status in ('open','under_review','actioned','dismissed','escalated')),created_at timestamptz not null default now(),unique(session_id,reporter,reason));
create table public.audit_events(id uuid primary key default gen_random_uuid(),household_id uuid references public.households,actor uuid not null references auth.users,action text not null,reference_id uuid,detail jsonb not null default '{}',created_at timestamptz not null default now());
create table public.ai_evaluations(id uuid primary key default gen_random_uuid(),session_id uuid not null references public.game_sessions,provider text not null default 'curated',model text not null default 'reviewed-hints',prompt_version text not null default '1',rubric_version text not null default '1',output text not null,created_at timestamptz not null default now());
create table public.game_nights(id uuid primary key default gen_random_uuid(),household_id uuid not null references public.households,scheduled_at timestamptz not null,mode text not null check(mode in ('quick','solve','build','debate','world')),created_at timestamptz not null default now());
create table private.staff(user_id uuid primary key references auth.users,role text not null check(role in ('admin','moderator')));
revoke all on all tables in schema private from public,anon,authenticated;
create index children_household on public.child_profiles(household_id);
create index versions_challenge on public.challenge_versions(challenge_id);
create index sessions_household on public.game_sessions(household_id,created_at desc);
create index sessions_version on public.game_sessions(challenge_version_id);
create index players_child on public.session_players(child_id);
create index answers_step on public.player_answers(step_id);
create index scores_child on public.score_events(child_id);
create index passport_child on public.passport_entries(child_id);
create index cases_household on public.moderation_cases(household_id);
create index cases_session on public.moderation_cases(session_id);
create index cases_reporter on public.moderation_cases(reporter);
create index audit_household on public.audit_events(household_id,created_at desc);
create index audit_actor on public.audit_events(actor);
create index ai_session on public.ai_evaluations(session_id);
create index nights_household on public.game_nights(household_id);

-- Private privilege boundary; identity comes exclusively from the verified JWT.
create function private.owns(h uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.households where id=h and guardian_id=(select auth.uid()))$$;
create function private.is_staff(required_role text default null) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from private.staff where user_id=(select auth.uid()) and (required_role is null or role=required_role))$$;
create function private.owns_session(s uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.game_sessions where id=s and private.owns(household_id))$$;
revoke all on function private.owns(uuid),private.is_staff(text),private.owns_session(uuid) from public;
grant execute on function private.owns(uuid),private.is_staff(text),private.owns_session(uuid) to authenticated;

alter table private.answer_keys enable row level security;
alter table private.staff enable row level security;
do $$declare t text;begin foreach t in array array['households','guardian_permissions','child_profiles','challenges','challenge_versions','challenge_steps','game_sessions','session_players','player_answers','build_submissions','score_events','passport_entries','moderation_cases','audit_events','ai_evaluations','game_nights'] loop execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);end loop;end$$;
create policy own_household on public.households for select to authenticated using(guardian_id=(select auth.uid()));
create policy own_permissions on public.guardian_permissions for select to authenticated using(private.owns(household_id));
create policy own_children on public.child_profiles for select to authenticated using(private.owns(household_id));
create policy content_challenges on public.challenges for select to authenticated using(true);
create policy content_versions on public.challenge_versions for select to authenticated using(status='published' or private.is_staff('admin') or exists(select 1 from public.game_sessions s where s.challenge_version_id=challenge_versions.id and private.owns(s.household_id)));
create policy content_steps on public.challenge_steps for select to authenticated using(exists(select 1 from public.challenge_versions v where v.id=version_id and (v.status='published' or private.is_staff('admin') or exists(select 1 from public.game_sessions s where s.challenge_version_id=v.id and private.owns(s.household_id)))));
create policy own_sessions on public.game_sessions for select to authenticated using(private.owns(household_id));
create policy own_players on public.session_players for select to authenticated using(private.owns_session(session_id));
create policy own_answers on public.player_answers for select to authenticated using(private.owns_session(session_id));
create policy own_builds on public.build_submissions for select to authenticated using(private.owns_session(session_id));
create policy own_scores on public.score_events for select to authenticated using(private.owns_session(session_id));
create policy own_passport on public.passport_entries for select to authenticated using(private.owns_session(session_id));
create policy own_reports on public.moderation_cases for select to authenticated using(private.owns(household_id) or private.is_staff());
create policy own_audit on public.audit_events for select to authenticated using(private.owns(household_id) or private.is_staff());
create policy own_q on public.ai_evaluations for select to authenticated using(private.owns_session(session_id));
create policy own_nights on public.game_nights for select to authenticated using(private.owns(household_id));
-- All client mutations go through one validated, transactional command boundary.
revoke insert,update,delete on all tables in schema public from anon,authenticated;

create function private.command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; sid uuid; vid uuid; cid uuid; st public.game_sessions; v public.challenge_versions; step public.challenge_steps; k private.answer_keys; pts int; n int; total int; result jsonb:='{}'; mode_name text; ref uuid; textout text; newstate text; plan_total int; allocation jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 select id into hid from public.households where guardian_id=uid;
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
end$$;
revoke all on function private.command(text,jsonb) from public;
grant execute on function private.command(text,jsonb) to authenticated;
create function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.command(command,payload)$$;
revoke all on function public.qz_command(text,jsonb) from public;
grant execute on function public.qz_command(text,jsonb) to authenticated;
create function public.qz_is_staff(required_role text default null) returns boolean language sql stable security invoker set search_path='' as $$select private.is_staff(required_role)$$;
revoke all on function public.qz_is_staff(text) from public;
grant execute on function public.qz_is_staff(text) to authenticated;

-- Immutable published content: updates require a new version, never mutate session history.
create function private.immutable_content() returns trigger language plpgsql set search_path='' as $$begin
 if TG_TABLE_NAME='challenge_versions' then
  if OLD.status in ('published','retired') then raise exception 'Published versions are immutable';end if;
 else
  if exists(select 1 from public.challenge_versions where id=OLD.version_id and status in ('published','retired')) then raise exception 'Published steps are immutable';end if;
 end if;return NEW;end$$;
create trigger versions_immutable before update or delete on public.challenge_versions for each row execute function private.immutable_content();
create trigger steps_immutable before update or delete on public.challenge_steps for each row execute function private.immutable_content();

-- Reviewed pilot learning content. Each choice is structured; no open messaging or uploads.
do $$declare cid uuid;vid uuid;sid uuid;r record;q record;begin
 for r in select * from (values
 ('quick','Curiosity kick-off','A quick team warm-up for curious minds.',8,null::text,'Explore everyday science together. Read each question aloud, talk about the possibilities, then agree on an answer.'),
 ('solve','Power the Island','Keep an island running through a changing energy challenge.',20,null,'Your island has $100,000. Solar costs $35,000, wind $30,000, battery $20,000, grid repair $25,000, efficiency $10,000, and diesel $40,000. Make three decisions as a team. Each plan is evaluated against the stated constraints.'),
 ('build','The brilliant bus stop','Design a useful, affordable shelter for your community.',15,null,'Your team has $10,000 to create a bus shelter. Choose a practical design, plan the budget, and decide how to explain your idea. Work with a grown-up and discuss each choice.'),
 ('debate','A park for everyone','Practice making a case and listening to another view.',15,null,'Your assigned position: protect quiet nature spaces in a community park. Explore the strongest argument, understand the other side, and build a respectful compromise. You are debating the scenario together, not messaging other children.'),
 ('world','Water-wise cities','Explore how cities can make better use of rain.',15,'Singapore','Explore Singapore and the challenge of collecting water in a busy city. Think about storage, clean water, and everyday habits. This activity shares no child identity or submission with other households.')
 ) t(mode,title,description,minutes,country,scenario) loop
 insert into public.challenges(title,mode,description,minutes,country) values(r.title,r.mode,r.description,r.minutes,r.country) returning id into cid;
 insert into public.challenge_versions(challenge_id,scenario,status,age_reviewed) values(cid,r.scenario,'draft',true) returning id into vid;
 for q in select * from (values
 ('quick',1,'Which action helps a plant make its own food?','["Putting it in a dark cupboard","Giving it light and water","Removing all its leaves"]'::jsonb,1,'Think about what green leaves use from the sun.','Plants use light, water, and carbon dioxide in photosynthesis.'),
 ('quick',2,'Which material can usually be recycled many times?','["A glass bottle","A used tissue","A banana peel"]'::jsonb,0,'Think about a material that can be melted and reshaped.','Glass can be recycled repeatedly when collected and processed correctly.'),
 ('quick',3,'Why do we see lightning before hearing thunder?','["Clouds save the sound","Light travels faster than sound","Our ears close during storms"]'::jsonb,1,'Compare the speed of light with the speed of sound.','Light travels much faster than sound, so it reaches us first.'),
 ('solve',1,'Which plan stays within $100,000 and includes battery storage?','["Solar + wind + battery + grid repair ($110,000)","Solar + wind + battery + efficiency ($95,000)","Diesel + solar + wind ($105,000)"]'::jsonb,1,'Add every cost and check for a battery.','The $95,000 plan meets both constraints and leaves $5,000 unspent.'),
 ('solve',2,'Storm alert: wind output will fall. What should the team do next?','["Ignore the forecast","Check demand and stored energy before changing the plan","Spend money without checking the remaining budget"]'::jsonb,1,'A useful plan uses new evidence and checks its constraints.','Checking demand and battery capacity supports an informed response to changing weather.'),
 ('solve',3,'Fuel costs rise. Which long-term action reduces dependence on diesel?','["Use efficiency measures and compare renewable supply","Buy more diesel without comparing costs","Stop maintaining the grid"]'::jsonb,0,'Think about both how much energy you need and where it comes from.','Efficiency reduces demand while renewable generation can reduce recurring fuel use. Reliability still needs a balanced plan.'),
 ('build',1,'Which design best addresses both rain and accessibility?','["A covered shelter with step-free access","An uncovered platform with stairs","A decoration with no seating"]'::jsonb,0,'Who might need to use the shelter in wet weather?','A covered, step-free shelter responds to rain and makes access easier for more people.'),
 ('build',2,'Roof $4,000, access path $2,500, seats $2,000. What remains?','["$500","$1,500","$3,500"]'::jsonb,1,'Subtract the three costs from $10,000.','The plan costs $8,500, leaving $1,500 for contingencies or maintenance.'),
 ('build',3,'Which pitch makes the strongest practical case?','["Everyone will like it, so no testing is needed","Describe users, costs, accessibility, and a way to test the design","Promise every possible feature"]'::jsonb,1,'A good pitch explains who benefits and how you know it can work.','A practical pitch connects the problem, the users, the budget, and a plan for testing.'),
 ('debate',1,'What is the strongest opening for your assigned position?','["People who want sports are wrong","Quiet spaces support wildlife and offer places to rest","No one should ever play outside"]'::jsonb,1,'Use reasons that another person can consider respectfully.','A clear reason supports your position without attacking people who hold a different view.'),
 ('debate',2,'What is a fair counterargument to consider?','["Sports areas support exercise and community activity","People with different views do not matter","There is no reason to discuss parks"]'::jsonb,0,'Try to express the other side as fairly as you express your own.','Recognizing the benefits of activity helps you weigh the tradeoffs honestly.'),
 ('debate',3,'Which closing offers a constructive compromise?','["Only one group should use the park","Separate quiet habitats and activity areas, then review how they work","Cancel the park"]'::jsonb,1,'Can different needs coexist with clear boundaries?','A zoned park can protect quiet spaces while retaining places for activity. Reviewing results makes the compromise testable.'),
 ('world',1,'What should happen before collected rainwater is used for drinking?','["Check and treat it to meet drinking-water standards","Assume it is clean because it looks clear","Add food coloring"]'::jsonb,0,'Clear water can still contain things you cannot see.','Drinking water must meet safety standards; appearance alone is not a safety test.'),
 ('world',2,'How can a city reduce water demand?','["Repair leaks and encourage efficient use","Leave taps running","Ignore faulty pipes"]'::jsonb,0,'Think about water lost before it can be used.','Repairing leaks and using water efficiently can reduce avoidable demand.'),
 ('world',3,'What is a useful first question before copying another city’s plan?','["Does our climate, budget, and infrastructure fit this idea?","Can we copy it without checking anything?","Is the city name short?"]'::jsonb,0,'Solutions depend on the place where they are used.','Comparing local conditions helps adapt an idea rather than assuming it works everywhere.')
 ) t(mode,ordinal,prompt,options,correct,hint,explanation) where mode=r.mode loop
 insert into public.challenge_steps(version_id,ordinal,prompt,options,hint) values(vid,q.ordinal,q.prompt,q.options,q.hint) returning id into sid;
 insert into private.answer_keys values(sid,q.correct,q.explanation);
 end loop;
 if r.mode='build' then update public.challenge_steps set kind='blueprint',prompt='Design your bus shelter. Choose features while keeping the total within $10,000.' where version_id=vid and ordinal=1;end if;
 if r.mode='debate' then
  update public.challenge_steps set ordinal=ordinal+100 where version_id=vid;
  update public.challenge_steps set ordinal=case ordinal when 101 then 1 when 102 then 3 when 103 then 5 end where version_id=vid;
  for q in select * from (values
   (2,'Which evidence would best support a quiet habitat area?','["A local wildlife survey and observations of how people use the park","An insult about another group","A made-up statistic"]'::jsonb,0,'Consider evidence that someone else could check.','Verifiable local evidence makes an argument stronger and helps reveal its limitations.'),
   (4,'How can you respond respectfully to the need for a sports area?','["Ignore the point","Recognize the benefit of exercise, then explain how separate spaces can protect habitats","Say that only your view matters"]'::jsonb,1,'A rebuttal can acknowledge a good point before answering it.','A respectful rebuttal addresses the argument, recognizes legitimate needs, and explains your reasoning.'),
   (6,'What is a useful reflection after the debate?','["Did we win by speaking loudest?","Which evidence changed our thinking, and whose needs should we consider next?","Can we avoid listening next time?"]'::jsonb,1,'Think about how your view developed, not just which side won.','Reflecting on evidence, listening, and overlooked needs turns a debate into a learning experience.')
  ) t(ordinal,prompt,options,correct,hint,explanation) loop
   insert into public.challenge_steps(version_id,ordinal,prompt,options,hint) values(vid,q.ordinal,q.prompt,q.options,q.hint) returning id into sid;
   insert into private.answer_keys values(sid,q.correct,q.explanation);
  end loop;
 end if;
 if r.mode='solve' then update public.challenge_steps set kind='allocation',prompt='Allocate your $100,000 island budget. Balance renewables, storage, and efficiency.' where version_id=vid and ordinal=1;end if;
 update public.challenge_versions set status='published' where id=vid;
 end loop;end$$;
