-- QZ-28: staff-only operational overview. Aggregates only: no names, emails, or row ids.
create function private.ops_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_staff() then raise exception 'Operations view requires a staff role';end if;
 return jsonb_build_object(
  'generatedAt', now(),
  'households', (select count(*) from public.households),
  'explorers', jsonb_build_object(
    'active', (select count(*) from public.child_profiles where archived_at is null),
    'archived', (select count(*) from public.child_profiles where archived_at is not null)),
  'sessions7d', coalesce((select jsonb_object_agg(state, n) from (select state, count(*) n from public.game_sessions where created_at > now()-interval '7 days' group by state) x), '{}'::jsonb),
  'completions30d', coalesce((select jsonb_object_agg(mode, n) from (
     select c.mode, count(*) n from public.game_sessions g join public.challenge_versions v on v.id=g.challenge_version_id join public.challenges c on c.id=v.challenge_id
     where g.state='complete' and g.completed_at > now()-interval '30 days' and not g.practice group by c.mode) x), '{}'::jsonb),
  'practice30d', (select count(*) from public.game_sessions where practice and created_at > now()-interval '30 days'),
  'openGameReports', (select count(*) from public.moderation_cases where status not in ('actioned','dismissed')),
  'openSafeZoneReports', coalesce((select jsonb_object_agg(severity, n) from (select severity, count(*) n from public.safezone_reports where status not in ('actioned','dismissed') group by severity) x), '{}'::jsonb),
  'flags', private.flags(),
  'rateLimitHits1h', coalesce((select jsonb_object_agg(bucket, n) from (select bucket, count(*) n from private.rate_events where at > now()-interval '1 hour' group by bucket) x), '{}'::jsonb),
  'accountDeletions', jsonb_build_object(
    'total', (select count(*) from private.account_deletions),
    'last30d', (select count(*) from private.account_deletions where deleted_at > now()-interval '30 days')),
  'consent', jsonb_build_object(
    'current', private.current_consent(),
    'householdsPending', (select count(*) from public.households where consent_version < private.current_consent())),
  'badgesAwarded7d', (select count(*) from public.child_badges where awarded_at > now()-interval '7 days'),
  'publishedChallenges', (select count(*) from public.challenge_versions where status='published'),
  'draftChallenges', (select count(*) from public.challenge_versions where status in ('draft','review'))
 );
end$$;
revoke all on function private.ops_overview() from public, anon, authenticated;
grant execute on function private.ops_overview() to authenticated;
create function public.qz_ops_overview() returns jsonb language sql stable security invoker set search_path='' as $$select private.ops_overview()$$;
revoke all on function public.qz_ops_overview() from public, anon;
grant execute on function public.qz_ops_overview() to authenticated;
