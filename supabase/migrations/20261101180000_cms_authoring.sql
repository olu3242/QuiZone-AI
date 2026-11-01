-- QZ-22: multi-step authoring, versioning, and retirement (additive).
-- Published versions stay immutable; the ONLY permitted change is published → retired.
create or replace function private.immutable_content() returns trigger language plpgsql set search_path='' as $$begin
 if TG_TABLE_NAME='challenge_versions' then
  if TG_OP='UPDATE' and OLD.status='published' and NEW.status='retired'
     and (NEW.challenge_id,NEW.version,NEW.scenario,NEW.min_age,NEW.max_age,NEW.age_reviewed)
         is not distinct from (OLD.challenge_id,OLD.version,OLD.scenario,OLD.min_age,OLD.max_age,OLD.age_reviewed) then
   return NEW;
  end if;
  if OLD.status in ('published','retired') then raise exception 'Published versions are immutable';end if;
 else
  if exists(select 1 from public.challenge_versions where id=OLD.version_id and status in ('published','retired')) then raise exception 'Published steps are immutable';end if;
 end if;
 return case when TG_OP='DELETE' then OLD else NEW end;
end$$;

-- Publishing a version retires the challenge's older published versions, so new
-- sessions always get the newest content while past sessions keep theirs.
create function private.retire_superseded() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.challenge_versions set status='retired' where challenge_id=NEW.challenge_id and id<>NEW.id and status='published';
 return NEW;
end$$;
create trigger versions_supersede after update of status on public.challenge_versions
 for each row when (NEW.status='published' and OLD.status is distinct from 'published') execute function private.retire_superseded();

-- Informational quality findings (QZ-23 makes them a publish gate).
create function private.quality_issues(vid uuid) returns text[] language plpgsql stable security definer set search_path='' as $$
declare v public.challenge_versions; c public.challenges; s record; issues text[]:='{}'; n int:=0;
begin
 select * into v from public.challenge_versions where id=vid;
 select * into c from public.challenges where id=v.challenge_id;
 if length(coalesce(v.scenario,'')) < 20 then issues:=issues||'Scenario must be at least 20 characters'; end if;
 if c.mode='world' and c.country is null then issues:=issues||'WorldZone challenges need a country'; end if;
 for s in select st.ordinal, st.kind, st.prompt, st.options, st.hint, k.correct, k.explanation from public.challenge_steps st left join private.answer_keys k on k.step_id=st.id where st.version_id=vid order by st.ordinal loop
  n:=n+1;
  if s.correct is null or s.explanation is null then issues:=issues||format('Step %s has no answer key',s.ordinal); continue; end if;
  if s.kind='choice' then
   if (select count(distinct lower(trim(o #>> '{}'))) from jsonb_array_elements(s.options) o) < jsonb_array_length(s.options) then issues:=issues||format('Step %s has duplicate options',s.ordinal); end if;
   if s.correct >= jsonb_array_length(s.options) then issues:=issues||format('Step %s marks a missing option as correct',s.ordinal); end if;
  end if;
  if length(s.prompt) < 10 then issues:=issues||format('Step %s prompt is too short',s.ordinal); end if;
  if length(s.explanation) < 10 then issues:=issues||format('Step %s needs an explanation',s.ordinal); end if;
  if lower(trim(s.hint))=lower(trim(s.explanation)) then issues:=issues||format('Step %s hint gives the answer away (same as explanation)',s.ordinal); end if;
 end loop;
 if n=0 then issues:=issues||'Add at least one step'; end if;
 return issues;
end$$;
revoke all on function private.quality_issues(uuid) from public, anon, authenticated;

create or replace function private.cms_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ref uuid; v public.challenge_versions; st public.challenge_steps; nv uuid; n int; r record; result jsonb:='{}'::jsonb;
begin
 if uid is null or not private.is_staff('admin') then raise exception 'Content tools require an administrator role';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 if command='cms_meta' then
  update public.challenges set subject=payload->>'subject', difficulty=payload->>'difficulty' where id=(payload->>'challenge')::uuid returning id into ref;
  if ref is null then raise exception 'Challenge not found';end if;
 elsif command in ('cms_step_add','cms_step_update','cms_step_delete','cms_version_update') then
  if command in ('cms_step_update','cms_step_delete') then
   select * into st from public.challenge_steps where id=(payload->>'step')::uuid;
   if not found then raise exception 'Step not found';end if;
   select * into v from public.challenge_versions where id=st.version_id for update;
  else
   select * into v from public.challenge_versions where id=(payload->>'version')::uuid for update;
  end if;
  if v.id is null then raise exception 'Version not found';end if;
  if v.status not in ('draft','review') then raise exception 'Only draft versions can be edited. Create a new version first';end if;
  if command in ('cms_step_add','cms_step_update') then
   if command='cms_step_update' and st.kind<>'choice' then raise exception 'This step type is edited in code';end if;
   if jsonb_typeof(payload->'options') is distinct from 'array' or jsonb_array_length(payload->'options') not between 2 and 6
      or exists(select 1 from jsonb_array_elements(payload->'options') o where jsonb_typeof(o)<>'string' or length(o#>>'{}') not between 1 and 150)
      or length(coalesce(payload->>'prompt','')) not between 10 and 500 or length(coalesce(payload->>'hint','')) not between 10 and 300
      or length(coalesce(payload->>'explanation','')) not between 10 and 500
      or (payload->>'correct')::int not between 0 and jsonb_array_length(payload->'options')-1 then
    raise exception 'Invalid step content';
   end if;
  end if;
  if command='cms_step_add' then
   select coalesce(max(ordinal),0) into n from public.challenge_steps where version_id=v.id;
   if n>=10 then raise exception 'A version supports up to ten steps';end if;
   insert into public.challenge_steps(version_id,ordinal,prompt,options,hint) values(v.id,n+1,payload->>'prompt',payload->'options',payload->>'hint') returning id into ref;
   insert into private.answer_keys values(ref,(payload->>'correct')::int,payload->>'explanation');
   result:=jsonb_build_object('step',ref);
  elsif command='cms_step_update' then
   update public.challenge_steps set prompt=payload->>'prompt',options=payload->'options',hint=payload->>'hint' where id=st.id;
   update private.answer_keys set correct=(payload->>'correct')::int,explanation=payload->>'explanation' where step_id=st.id;
   ref:=st.id;
  elsif command='cms_step_delete' then
   if (select count(*) from public.challenge_steps where version_id=v.id)<=1 then raise exception 'A version needs at least one step';end if;
   delete from private.answer_keys where step_id=st.id;
   delete from public.challenge_steps where id=st.id;
   update public.challenge_steps set ordinal=ordinal+100 where version_id=v.id;
   n:=0;
   for r in select id from public.challenge_steps where version_id=v.id order by ordinal loop
    n:=n+1; update public.challenge_steps set ordinal=n where id=r.id;
   end loop;
   ref:=st.id;
  else
   if length(coalesce(payload->>'scenario','')) not between 20 and 1000 then raise exception 'Scenario must be 20 to 1000 characters';end if;
   update public.challenge_versions set scenario=payload->>'scenario',min_age=(payload->>'minAge')::int,max_age=(payload->>'maxAge')::int,age_reviewed=false where id=v.id;
   ref:=v.id;
  end if;
 elsif command='cms_version_new' then
  select * into v from public.challenge_versions where challenge_id=(payload->>'challenge')::uuid order by version desc limit 1 for update;
  if not found then raise exception 'Challenge not found';end if;
  if exists(select 1 from public.challenge_versions where challenge_id=v.challenge_id and status in ('draft','review')) then raise exception 'This challenge already has an open draft';end if;
  insert into public.challenge_versions(challenge_id,version,status,scenario,min_age,max_age,age_reviewed)
   values(v.challenge_id,v.version+1,'draft',v.scenario,v.min_age,v.max_age,false) returning id into nv;
  for r in select st2.*, k.correct, k.explanation from public.challenge_steps st2 join private.answer_keys k on k.step_id=st2.id where st2.version_id=v.id order by st2.ordinal loop
   insert into public.challenge_steps(version_id,ordinal,kind,prompt,options,hint) values(nv,r.ordinal,r.kind,r.prompt,r.options,r.hint) returning id into ref;
   insert into private.answer_keys values(ref,r.correct,r.explanation);
  end loop;
  ref:=nv; result:=jsonb_build_object('version',nv);
 elsif command='cms_version_retire' then
  select * into v from public.challenge_versions where id=(payload->>'version')::uuid for update;
  if not found or v.status<>'published' then raise exception 'Only a published version can be retired';end if;
  update public.challenge_versions set status='retired' where id=v.id;
  ref:=v.id;
 else raise exception 'Unknown command';end if;
 insert into public.audit_events(household_id,actor,action,reference_id) values(null,uid,command,ref);
 return result;
end$$;

-- Admin-only editing view: includes answer keys (never exposed to families).
create function private.cms_version(vid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff('admin') then raise exception 'Content tools require an administrator role';end if;
 return (select jsonb_build_object(
  'id',v.id,'version',v.version,'status',v.status,'scenario',v.scenario,'minAge',v.min_age,'maxAge',v.max_age,'ageReviewed',v.age_reviewed,
  'issues',to_jsonb(private.quality_issues(v.id)),
  'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'ordinal',s.ordinal,'kind',s.kind,'prompt',s.prompt,'options',s.options,'hint',s.hint,'correct',k.correct,'explanation',k.explanation) order by s.ordinal)
    from public.challenge_steps s left join private.answer_keys k on k.step_id=s.id where s.version_id=v.id),'[]'::jsonb))
  from public.challenge_versions v where v.id=vid);
end$$;
revoke all on function private.cms_version(uuid) from public, anon, authenticated;
grant execute on function private.cms_version(uuid) to authenticated;
create function public.qz_cms_version(vid uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.cms_version(vid)$$;
revoke all on function public.qz_cms_version(uuid) from public, anon;
grant execute on function public.qz_cms_version(uuid) to authenticated;
