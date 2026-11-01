-- QZ-06: operator kill switches for every game zone and Q hints (additive).
-- Seeded ON to preserve the verified pilot; an operator turns one off with:
--   update private.feature_flags set enabled=false where flag='zone_world';
-- Enforced by triggers so every code path (app API, direct RPC) is covered.
-- Turning a zone off blocks NEW sessions; sessions already started can finish.
insert into private.feature_flags(flag, enabled) values
 ('zone_quick', true), ('zone_solve', true), ('zone_build', true),
 ('zone_debate', true), ('zone_world', true), ('q_hints', true)
on conflict (flag) do nothing;

create function private.zone_open() returns trigger language plpgsql security definer set search_path='' as $$
declare m text;
begin
 select c.mode into m from public.challenge_versions v join public.challenges c on c.id=v.challenge_id where v.id=NEW.challenge_version_id;
 if not private.flag('zone_'||m) then raise exception 'This zone is paused right now. Try another adventure.'; end if;
 return NEW;
end$$;
create trigger sessions_zone_open before insert on public.game_sessions for each row execute function private.zone_open();

create function private.hints_open() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not private.flag('q_hints') then raise exception 'Guided hints are paused right now.'; end if;
 return NEW;
end$$;
create trigger hints_open before insert on public.ai_evaluations for each row execute function private.hints_open();
revoke all on function private.zone_open(), private.hints_open() from public, anon, authenticated;

-- Read-only flag map for the UI (flag names and booleans only; nothing sensitive).
create function private.flags() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(flag, enabled), '{}'::jsonb) from private.feature_flags
$$;
revoke all on function private.flags() from public, anon, authenticated;
grant execute on function private.flags() to authenticated;
create function public.qz_flags() returns jsonb language sql stable security invoker set search_path='' as $$select private.flags()$$;
revoke all on function public.qz_flags() from public, anon;
grant execute on function public.qz_flags() to authenticated;
