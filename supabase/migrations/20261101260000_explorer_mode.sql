-- QZ-32: Explorer mode — a server-enforced lock for the shared screen (additive).
-- Children still have no accounts. A grown-up locks the device they're signed in on;
-- the lock is bound to that Supabase Auth session (JWT session_id), so nothing on the
-- client can lift it. Unlocking means signing in again with the adult's password,
-- which mints a new, unlocked session. While locked, only play is allowed.
create table private.explorer_locks(
 session_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 locked_at timestamptz not null default now());
create index explorer_locks_user on private.explorer_locks(user_id);
alter table private.explorer_locks enable row level security;
revoke all on private.explorer_locks from public, anon, authenticated;

create function private.jwt_session() returns uuid language plpgsql stable set search_path='' as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
 if coalesce(claims->>'session_id','') !~ '^[0-9a-fA-F-]{36}$' then return null; end if;
 return (claims->>'session_id')::uuid;
end$$;
create function private.locked() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.explorer_locks where session_id=private.jwt_session() and user_id=(select auth.uid()))$$;
revoke all on function private.jwt_session(), private.locked() from public, anon, authenticated;
grant execute on function private.jwt_session(), private.locked() to authenticated;
create function public.qz_locked() returns boolean language sql stable security invoker set search_path='' as $$select private.locked()$$;
revoke all on function public.qz_locked() from public, anon;
grant execute on function public.qz_locked() to authenticated;

-- Guardian-only oversight data (reports, audit, consent records, invites, SafeZone
-- registrations/reports/notifications) is read through private.owns. A locked
-- session reads none of it; play data (private.member_of) is unaffected.
create or replace function private.owns(h uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.households where id=h and guardian_id=(select auth.uid())) and not private.locked()$$;

create function private.explorer_lock() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); sid uuid:=private.jwt_session(); hid uuid;
begin
 if uid is null then raise exception 'Sign in first';end if;
 if sid is null then raise exception 'Sign in again to use Explorer mode';end if;
 hid:=(private.my_household()->>'id')::uuid;
 if hid is null then raise exception 'Create a household first';end if;
 -- Locks outlive nothing: drop this adult's locks older than a refresh-token lifetime.
 delete from private.explorer_locks where user_id=uid and locked_at<now()-interval '30 days';
 insert into private.explorer_locks(session_id,user_id) values(sid,uid) on conflict do nothing;
 insert into public.audit_events(household_id,actor,action) values(hid,uid,'explorer_lock');
 return jsonb_build_object('locked',true);
end$$;
revoke all on function private.explorer_lock() from public, anon, authenticated;
grant execute on function private.explorer_lock() to authenticated;

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
