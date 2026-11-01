-- QZ-33: Global Connect — how families around QuiZone answered WorldZone steps (additive).
-- Aggregate only (FAMILY.md §3): no household, explorer, or session identities ever leave
-- this function. A step's distribution is shown only once at least five distinct
-- households have answered it (k-anonymity floor), counting each household once (its
-- latest answer) and ignoring practice rounds. Operator kill switch: flag global_compare.
insert into private.feature_flags(flag, enabled) values ('global_compare', true) on conflict (flag) do nothing;

create function private.world_compare(sid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v uuid; m text; k constant int := 5; res jsonb := '[]'::jsonb; st record; n bigint; dist jsonb; mine int;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first';end if;
 if sid is null or not private.owns_session(sid) then raise exception 'Session not found or permission denied';end if;
 if not private.flag('global_compare') then return jsonb_build_object('enabled',false);end if;
 select g.challenge_version_id, c.mode into v, m from public.game_sessions g
  join public.challenge_versions cv on cv.id=g.challenge_version_id join public.challenges c on c.id=cv.challenge_id where g.id=sid;
 if m is distinct from 'world' then raise exception 'Comparisons are only available for WorldZone';end if;
 for st in select s.id, s.ordinal, s.prompt, s.options from public.challenge_steps s where s.version_id=v and s.kind='choice' order by s.ordinal loop
  -- One vote per household: its most recent non-practice answer to this step.
  with latest as (
   select distinct on (g.household_id) g.household_id, a.choice
   from public.player_answers a join public.game_sessions g on g.id=a.session_id
   where a.step_id=st.id and a.choice is not null and not g.practice
   order by g.household_id, a.created_at desc)
  select (select count(*) from latest),
   (select jsonb_agg(jsonb_build_object('option',x.i,
     'percent',round(100.0*(select count(*) from latest l where l.choice=x.i)/greatest((select count(*) from latest),1))) order by x.i)
    from generate_series(0,jsonb_array_length(st.options)-1) x(i))
   into n, dist;
  select a.choice into mine from public.player_answers a where a.session_id=sid and a.step_id=st.id;
  res := res || jsonb_build_object('step',st.ordinal,'prompt',st.prompt,'options',st.options,'yourChoice',mine,
   'available', n>=k, 'needed', k,
   'distribution', case when n>=k then dist else null end);
 end loop;
 return jsonb_build_object('enabled',true,'steps',res);
end$$;
revoke all on function private.world_compare(uuid) from public, anon, authenticated;
grant execute on function private.world_compare(uuid) to authenticated;
create function public.qz_world_compare(session uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.world_compare(session)$$;
revoke all on function public.qz_world_compare(uuid) from public, anon;
grant execute on function public.qz_world_compare(uuid) to authenticated;
