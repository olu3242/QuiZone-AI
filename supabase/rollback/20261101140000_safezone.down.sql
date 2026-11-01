create or replace function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select case when command in ('child_update','child_archive','child_delete','account_delete','export')
  then private.family_command(command,payload)
  else private.command(command,payload) end
$$;
drop function public.qz_safezone_room(uuid,uuid);
drop function public.qz_safezone_lobby();
drop function private.safezone_room(uuid,uuid);
drop function private.safezone_lobby();
drop function private.safezone_command(text,jsonb);
drop function private.sz_release(uuid,uuid,text,text);
drop function private.sz_notify_hall(uuid,text,text);
drop function private.sz_handle(uuid);
drop table public.safezone_notifications, public.safezone_report_events, public.safezone_reports,
 public.town_hall_votes, public.town_hall_polls, public.town_hall_contributions, public.town_hall_hands,
 public.town_hall_registrations, public.town_hall_options, public.town_hall_agenda, public.town_halls;
alter table public.guardian_permissions drop column safezone;
drop function private.recent_reauth(integer);
drop function private.flag(text);
drop table private.feature_flags;
