-- QZ-04 security hardening (additive).
-- 1. Per-user rate limits enforced in the database, so they hold for every path
--    (app API, direct PostgREST RPC). Over-limit raises SQLSTATE QZ429.
-- 2. Challenge catalog no longer exposes draft titles/descriptions to guardians.

create table private.rate_events(
 uid uuid not null,
 bucket text not null,
 at timestamptz not null default now()
);
create index rate_events_lookup on private.rate_events(uid, bucket, at);
alter table private.rate_events enable row level security;
revoke all on private.rate_events from public, anon, authenticated;

-- Sliding-window limiter. Rows are pruned per (uid, bucket) on every call.
-- Note: a hit inside a transaction that later fails is rolled back with it, so
-- the command bucket meters completed writes; brute-force-sensitive buckets
-- are hit in their own request (public.qz_rate) before the guarded action.
create function private.rate_limit(bucket text, max_hits integer, window_seconds integer) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); hits integer;
begin
 if me is null then raise exception 'Please sign in' using errcode='28000'; end if;
 delete from private.rate_events e where e.uid=me and e.bucket=rate_limit.bucket and e.at < now()-make_interval(secs=>window_seconds);
 select count(*) into hits from private.rate_events e where e.uid=me and e.bucket=rate_limit.bucket;
 if hits >= max_hits then
  raise exception 'Too many attempts. Please wait a few minutes and try again.' using errcode='QZ429';
 end if;
 insert into private.rate_events(uid,bucket) values(me,rate_limit.bucket);
end$$;
revoke all on function private.rate_limit(text,integer,integer) from public, anon, authenticated;

-- Named buckets callable by the app before brute-forceable actions. Clients can
-- only consume their own budget; limits are fixed here, not chosen by callers.
create function private.rate_check(bucket text) returns void language plpgsql security definer set search_path='' as $$begin
 case bucket
  when 'reauth' then perform private.rate_limit('reauth', 10, 900);   -- password re-verification
  when 'export' then perform private.rate_limit('export', 5, 3600);   -- data export
  else raise exception 'Unknown rate bucket';
 end case;
end$$;
revoke all on function private.rate_check(text) from public, anon, authenticated;
grant execute on function private.rate_check(text) to authenticated;
create function public.qz_rate(bucket text) returns void language sql security invoker set search_path='' as $$select private.rate_check(bucket)$$;
revoke all on function public.qz_rate(text) from public, anon;
grant execute on function public.qz_rate(text) to authenticated;
-- Fixed-parameter wrapper for the router: callers cannot choose limits or windows.
-- Anonymous callers skip metering so the command functions' canonical identity
-- refusal ("A confirmed guardian account is required") still applies.
create function private.rate_command() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then perform private.rate_limit('command', 300, 60); end if;
end$$;
revoke all on function private.rate_command() from public, anon, authenticated;
grant execute on function private.rate_command() to authenticated;

create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform private.rate_command();
 if command in ('child_update','child_archive','child_delete','account_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 end if;
 return private.command(command,payload);
end$$;
revoke all on function public.qz_command(text,jsonb) from public, anon;
grant execute on function public.qz_command(text,jsonb) to authenticated;

drop policy content_challenges on public.challenges;
create policy content_challenges on public.challenges for select to authenticated using(
 private.is_staff('admin')
 or exists(select 1 from public.challenge_versions v where v.challenge_id=challenges.id and v.status='published')
 or exists(select 1 from public.game_sessions s join public.challenge_versions v on v.id=s.challenge_version_id where v.challenge_id=challenges.id and private.owns(s.household_id))
);
