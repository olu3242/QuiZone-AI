drop trigger passport_badges on public.passport_entries;
drop trigger score_events_badges on public.score_events;
drop function private.on_passport_entry();
drop function private.on_score_event();
drop function private.award_household_badges(uuid,uuid);
drop function private.award_child_badges(uuid,uuid);
drop table public.household_badges, public.child_badges, public.badges;
