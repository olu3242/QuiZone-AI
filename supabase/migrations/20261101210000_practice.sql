-- QZ-25: practice rounds — real play, no XP / badges / stamps (additive).
alter table public.game_sessions add column practice boolean not null default false;

-- Marks a just-created lobby as practice; only the owning guardian, only before play.
create function private.mark_practice(sid uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.game_sessions set practice=true
  where id=sid and state='lobby' and private.owns(household_id)
   and not exists(select 1 from public.player_answers where session_id=sid);
 if not found then raise exception 'Session not found or permission denied';end if;
end$$;
revoke all on function private.mark_practice(uuid) from public, anon, authenticated;
grant execute on function private.mark_practice(uuid) to authenticated;

-- Completion of a practice round records answers and the session score, but never
-- progression: these rows are dropped before insert, so badge triggers never fire.
create function private.skip_practice_progress() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.game_sessions where id=NEW.session_id and practice) then return null; end if;
 return NEW;
end$$;
revoke all on function private.skip_practice_progress() from public, anon, authenticated;
create trigger score_events_practice before insert on public.score_events for each row execute function private.skip_practice_progress();
create trigger passport_practice before insert on public.passport_entries for each row execute function private.skip_practice_progress();

create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
 if command in ('child_update','child_archive','child_delete','account_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 elsif command like 'cms\_%' then
  return private.cms_command(command,payload);
 elsif command='create' and (payload->>'practice')='true' then
  r:=private.command(command,payload-'practice');
  perform private.mark_practice((r->>'session')::uuid);
  return r;
 end if;
 return private.command(command,payload);
end$$;
