-- QZ-35: scheduled maintenance (additive). One idempotent function does every routine
-- job; pg_cron runs it every 15 minutes where the extension exists (Supabase), and an
-- administrator can run it on demand. Every run is recorded with its counts.
alter table public.game_nights add column reminded_at timestamptz;

create table private.maintenance_runs(
 id bigserial primary key,
 ran_at timestamptz not null default now(),
 source text not null check (source in ('cron','operator')),
 actor uuid references auth.users(id) on delete set null,
 result jsonb not null);
alter table private.maintenance_runs enable row level security;
revoke all on private.maintenance_runs from public, anon, authenticated;

create function private.maintenance(src text default 'cron') returns jsonb language plpgsql security definer set search_path='' as $$
declare n_expired int; n_rate int; n_invites int; n_locks int; n_devices int; n_reminders int:=0; night record; res jsonb;
begin
 if src not in ('cron','operator') then raise exception 'Unknown maintenance source';end if;
 -- Games past their guardian time limit (otherwise expired lazily on next action).
 update public.game_sessions set state='expired' where state in ('lobby','ready','active','paused') and expires_at<=now();
 get diagnostics n_expired=row_count;
 -- Rate windows are at most an hour; a day of history is plenty.
 delete from private.rate_events where at<now()-interval '1 day';
 get diagnostics n_rate=row_count;
 -- Unused invites that were revoked or expired a week ago (used ones stay as a record).
 delete from public.household_invites where used_at is null and coalesce(revoked_at,expires_at)<now()-interval '7 days';
 get diagnostics n_invites=row_count;
 -- Explorer-mode locks outlive their Auth session by design; drop the old ones.
 delete from private.explorer_locks where locked_at<now()-interval '30 days';
 get diagnostics n_locks=row_count;
 delete from public.session_devices where last_seen<now()-interval '1 day';
 get diagnostics n_devices=row_count;
 -- Game-night reminders in the family inbox, once each, within 24 hours of the night.
 for night in select id, household_id, scheduled_at, mode from public.game_nights
   where reminded_at is null and scheduled_at>now() and scheduled_at<=now()+interval '24 hours' for update skip locked loop
  perform private.notify(night.household_id,'game_night','Game night coming up',
   'Scheduled for '||to_char(night.scheduled_at at time zone 'UTC','Dy DD Mon, HH24:MI')||' UTC.','/home',night.id);
  update public.game_nights set reminded_at=now() where id=night.id;
  n_reminders:=n_reminders+1;
 end loop;
 res:=jsonb_build_object('expiredSessions',n_expired,'rateEvents',n_rate,'invites',n_invites,'locks',n_locks,'devices',n_devices,'reminders',n_reminders);
 insert into private.maintenance_runs(source,actor,result) values(src,case when src='operator' then (select auth.uid()) end,res);
 delete from private.maintenance_runs where ran_at<now()-interval '30 days';
 return res;
end$$;
revoke all on function private.maintenance(text) from public, anon, authenticated;

-- Administrators: run now, and see recent runs (counts only, no personal data).
create function private.maintenance_now() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not private.is_staff('admin') then raise exception 'Operations tools require an administrator role';end if;
 return private.maintenance('operator');
end$$;
create function private.maintenance_runs() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private.is_staff('admin') then raise exception 'Operations tools require an administrator role';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('ranAt',ran_at,'source',source,'result',result) order by ran_at desc)
  from (select * from private.maintenance_runs order by ran_at desc limit 10) r),'[]'::jsonb);
end$$;
revoke all on function private.maintenance_now(), private.maintenance_runs() from public, anon, authenticated;
grant execute on function private.maintenance_now(), private.maintenance_runs() to authenticated;
create function public.qz_maintenance() returns jsonb language sql security invoker set search_path='' as $$select private.maintenance_now()$$;
create function public.qz_maintenance_runs() returns jsonb language sql stable security invoker set search_path='' as $$select private.maintenance_runs()$$;
revoke all on function public.qz_maintenance(), public.qz_maintenance_runs() from public, anon;
grant execute on function public.qz_maintenance(), public.qz_maintenance_runs() to authenticated;

-- Schedule it where pg_cron is available (Supabase local and hosted). Elsewhere
-- (e.g. the PGlite test harness) the schedule is skipped; the function still works.
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('qz-maintenance','*/15 * * * *',$job$select private.maintenance('cron')$job$);
 end if;
end$$;
