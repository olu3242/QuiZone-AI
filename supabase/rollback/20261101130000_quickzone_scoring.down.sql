drop trigger answers_after on public.player_answers;
drop trigger answers_quick_bonus on public.player_answers;
drop trigger sessions_step_clock on public.game_sessions;
drop function private.after_answer();
drop function private.quick_bonus();
drop function private.step_clock();
alter table public.player_answers drop column bonus, drop column elapsed_ms;
alter table public.game_sessions drop column step_started_at;
