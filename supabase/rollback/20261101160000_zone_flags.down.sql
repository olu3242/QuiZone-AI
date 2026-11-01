drop function public.qz_flags();
drop function private.flags();
drop trigger hints_open on public.ai_evaluations;
drop trigger sessions_zone_open on public.game_sessions;
drop function private.hints_open();
drop function private.zone_open();
delete from private.feature_flags where flag in ('zone_quick','zone_solve','zone_build','zone_debate','zone_world','q_hints');
