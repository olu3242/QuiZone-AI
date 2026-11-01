-- QZ-03: QuickZone speed + streak scoring, timed by the server clock only.
-- Additive: private.command still computes base points; these triggers add a
-- bounded bonus inside the same locked transaction and keep totals consistent.

alter table public.game_sessions add column step_started_at timestamptz;
alter table public.player_answers
  add column elapsed_ms integer check (elapsed_ms is null or elapsed_ms >= 0),
  add column bonus integer not null default 0 check (bonus between 0 and 50);

-- The step clock (re)starts whenever play becomes active, including resume.
create function private.step_clock() returns trigger language plpgsql set search_path='' as $$begin
 if NEW.state='active' and OLD.state is distinct from 'active' then NEW.step_started_at:=now(); end if;
 return NEW;
end$$;
create trigger sessions_step_clock before update of state on public.game_sessions for each row execute function private.step_clock();

-- Speed: correct within 20s +20, within 45s +10. Streak: +10 per prior consecutive
-- correct answer, capped at +30. Wrong answers keep participation points only.
create function private.quick_bonus() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.game_sessions; mode_name text; correct int; streak int:=0; r record; speed int:=0; extra int;
begin
 select * into g from public.game_sessions where id=NEW.session_id;
 select c.mode into mode_name from public.challenge_versions v join public.challenges c on c.id=v.challenge_id where v.id=g.challenge_version_id;
 if g.step_started_at is not null then NEW.elapsed_ms:=greatest(0,(extract(epoch from (now()-g.step_started_at))*1000)::int); end if;
 if mode_name<>'quick' or NEW.choice is null then return NEW; end if;
 select k.correct into correct from private.answer_keys k where k.step_id=NEW.step_id;
 if NEW.choice is distinct from correct then return NEW; end if;
 for r in select a.choice, k.correct from public.player_answers a join private.answer_keys k on k.step_id=a.step_id join public.challenge_steps s on s.id=a.step_id where a.session_id=NEW.session_id order by s.ordinal desc loop
  exit when r.choice is distinct from r.correct;
  streak:=streak+1;
 end loop;
 if NEW.elapsed_ms is not null then speed:=case when NEW.elapsed_ms<=20000 then 20 when NEW.elapsed_ms<=45000 then 10 else 0 end; end if;
 extra:=speed+least(streak*10,30);
 if extra>0 then
  NEW.bonus:=extra;
  NEW.points:=NEW.points+extra;
  NEW.feedback:=NEW.feedback||format(' Bonus +%s%s%s.',extra,case when speed>0 then format(' (speed +%s)',speed) else '' end,case when streak>0 then format(' (streak +%s)',least(streak*10,30)) else '' end);
 end if;
 return NEW;
end$$;
create trigger answers_quick_bonus before insert on public.player_answers for each row execute function private.quick_bonus();

-- Keep the session total equal to the sum of saved answer points, and restart
-- the clock for the next step.
create function private.after_answer() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.game_sessions set total_score=total_score+NEW.bonus, step_started_at=now() where id=NEW.session_id;
 return NEW;
end$$;
create trigger answers_after after insert on public.player_answers for each row execute function private.after_answer();
revoke all on function private.step_clock(), private.quick_bonus(), private.after_answer() from public, anon, authenticated;
