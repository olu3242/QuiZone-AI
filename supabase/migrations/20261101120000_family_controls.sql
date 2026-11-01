-- QZ-02: guardian data rights (edit/archive/delete explorers, export, account deletion).
-- Additive and backward compatible: private.command is untouched; public.qz_command
-- becomes a router so every client mutation still crosses one validated boundary.

alter table public.child_profiles add column archived_at timestamptz;
create index children_active on public.child_profiles(household_id) where archived_at is null;

-- Non-identifying deletion ledger: proves a deletion happened without retaining who.
create table private.account_deletions(
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  children integer not null,
  sessions integer not null,
  cases integer not null
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public, anon, authenticated;

-- Archived explorers cannot join new sessions, whichever code path inserts players.
create function private.active_player() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from public.child_profiles where id=NEW.child_id and archived_at is not null) then
  raise exception 'Archived explorers cannot join new adventures';
 end if;
 return NEW;
end$$;
create trigger players_active before insert on public.session_players for each row execute function private.active_player();

create function private.purge_sessions(sids uuid[]) returns void language plpgsql security definer set search_path='' as $$begin
 delete from public.ai_evaluations where session_id=any(sids);
 delete from public.player_answers where session_id=any(sids);
 delete from public.build_submissions where session_id=any(sids);
 delete from public.score_events where session_id=any(sids);
 delete from public.passport_entries where session_id=any(sids);
 delete from public.session_players where session_id=any(sids);
 delete from public.moderation_cases where session_id=any(sids);
 delete from public.game_sessions where id=any(sids);
end$$;
revoke all on function private.purge_sessions(uuid[]) from public, anon, authenticated;

create function private.family_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; hname text; c public.child_profiles; ref uuid; result jsonb:='{}'::jsonb; sids uuid[]; n_children int:=0; n_sessions int:=0; n_cases int:=0;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'A confirmed guardian account is required';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 select id,name into hid,hname from public.households where guardian_id=uid for update;

 if command='account_delete' then
  -- Staff actions are part of other households' audit trails; never self-erase them.
  if private.is_staff() then raise exception 'Staff accounts must be removed by an administrator';end if;
  if (payload->>'confirm') is distinct from coalesce(hname,'DELETE') then raise exception 'Type the confirmation text exactly to delete this account';end if;
  if hid is not null then
   sids:=array(select id from public.game_sessions where household_id=hid);
   select count(*) into n_children from public.child_profiles where household_id=hid;
   n_sessions:=coalesce(array_length(sids,1),0);
   select count(*) into n_cases from public.moderation_cases where household_id=hid or reporter=uid;
   perform private.purge_sessions(sids);
   delete from public.moderation_cases where household_id=hid or reporter=uid;
   delete from public.game_nights where household_id=hid;
   delete from public.child_profiles where household_id=hid;
   delete from public.guardian_permissions where household_id=hid;
   delete from public.audit_events where household_id=hid;
   delete from public.households where id=hid;
  end if;
  delete from public.audit_events where actor=uid;
  insert into private.account_deletions(children,sessions,cases) values(n_children,n_sessions,n_cases);
  delete from auth.users where id=uid;
  return jsonb_build_object('deleted',true);
 end if;

 if hid is null then raise exception 'Create a household first';end if;

 if command in ('child_update','child_archive','child_delete') then
  select * into c from public.child_profiles where id=(payload->>'child')::uuid and household_id=hid for update;
  if not found then raise exception 'Explorer not found or permission denied';end if;
  ref:=c.id;
  if command='child_update' then
   if c.archived_at is not null then raise exception 'Restore this explorer before editing';end if;
   if (payload->>'nickname') !~ '^[[:alnum:] _-]{2,24}$' then raise exception 'Use a nickname without personal contact details';end if;
   update public.child_profiles set nickname=trim(payload->>'nickname'),age=(payload->>'age')::int,avatar=payload->>'avatar',interest=payload->>'interest' where id=c.id;
  elsif command='child_archive' then
   if jsonb_typeof(payload->'archived') is distinct from 'boolean' then raise exception 'Invalid archive request';end if;
   update public.child_profiles set archived_at=case when (payload->>'archived')::boolean then coalesce(archived_at,now()) else null end where id=c.id;
  else
   if (payload->>'confirm') is distinct from c.nickname then raise exception 'Type the explorer nickname exactly to confirm deletion';end if;
   if exists(select 1 from public.session_players p join public.game_sessions g on g.id=p.session_id where p.child_id=c.id and g.state in ('lobby','ready','active','paused') and g.expires_at>now()) then
    raise exception 'Finish or cancel this explorer''s open adventures first';
   end if;
   if exists(select 1 from public.session_players p join public.moderation_cases m on m.session_id=p.session_id where p.child_id=c.id and m.status in ('open','under_review','escalated')) then
    raise exception 'A safety report about this explorer''s activity is still being reviewed';
   end if;
   -- Sessions this explorer played alone are their activity record: remove them entirely.
   sids:=array(select p.session_id from public.session_players p where p.child_id=c.id and not exists(select 1 from public.session_players o where o.session_id=p.session_id and o.child_id<>c.id));
   perform private.purge_sessions(sids);
   delete from public.score_events where child_id=c.id;
   delete from public.passport_entries where child_id=c.id;
   delete from public.session_players where child_id=c.id;
   delete from public.child_profiles where id=c.id;
   result:=jsonb_build_object('deleted',true,'sessions',coalesce(array_length(sids,1),0));
  end if;
 elsif command='export' then
  null; -- Audit-only: records that the guardian downloaded their household data.
 else raise exception 'Unknown command';end if;

 insert into public.audit_events(household_id,actor,action,reference_id) values(hid,uid,command,ref);
 return result;
end$$;
revoke all on function private.family_command(text,jsonb) from public;
grant execute on function private.family_command(text,jsonb) to authenticated;

create or replace function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select case when command in ('child_update','child_archive','child_delete','account_delete','export')
  then private.family_command(command,payload)
  else private.command(command,payload) end
$$;
revoke all on function public.qz_command(text,jsonb) from public;
grant execute on function public.qz_command(text,jsonb) to authenticated;
