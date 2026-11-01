create or replace function public.qz_command(command text,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.command(command,payload)$$;
drop function private.family_command(text,jsonb);
drop function private.purge_sessions(uuid[]);
drop trigger players_active on public.session_players;
drop function private.active_player();
drop table private.account_deletions;
drop index public.children_active;
alter table public.child_profiles drop column archived_at;
