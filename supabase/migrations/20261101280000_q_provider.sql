-- QZ-34: Q live-provider boundary for content authors (additive).
-- A live model only ever *suggests* hint text to an administrator inside the CMS. Nothing
-- it writes reaches a child unless a person edits, saves, and publishes it through the
-- quality gate and age review. Off until an operator turns it on:
--   update private.feature_flags set enabled=true where flag='q_live';
insert into private.feature_flags(flag, enabled) values ('q_live', false) on conflict (flag) do nothing;

create or replace function private.rate_check(bucket text) returns void language plpgsql security definer set search_path='' as $$begin
 case bucket
  when 'reauth' then perform private.rate_limit('reauth', 10, 900);   -- password re-verification
  when 'export' then perform private.rate_limit('export', 5, 3600);   -- data export
  when 'q_suggest' then perform private.rate_limit('q_suggest', 30, 3600); -- live-model suggestions
  else raise exception 'Unknown rate bucket';
 end case;
end$$;

-- Every suggestion is attributable: who asked, for which step, which model, how long.
create function private.q_suggest_log(step uuid, model text, chars integer) returns void language plpgsql security definer set search_path='' as $$begin
 if not private.is_staff('admin') then raise exception 'Content tools require an administrator role';end if;
 if not private.flag('q_live') then raise exception 'Q suggestions are off';end if;
 if not exists(select 1 from public.challenge_steps where id=step) then raise exception 'Step not found';end if;
 insert into public.audit_events(actor,action,reference_id,detail)
  values((select auth.uid()),'q_suggest',step,jsonb_build_object('model',left(model,64),'chars',greatest(0,least(chars,1000))));
end$$;
revoke all on function private.q_suggest_log(uuid,text,integer) from public, anon, authenticated;
grant execute on function private.q_suggest_log(uuid,text,integer) to authenticated;
create function public.qz_q_suggest_log(step uuid, model text, chars integer) returns void language sql security invoker set search_path='' as $$select private.q_suggest_log(step,model,chars)$$;
revoke all on function public.qz_q_suggest_log(uuid,text,integer) from public, anon;
grant execute on function public.qz_q_suggest_log(uuid,text,integer) to authenticated;
