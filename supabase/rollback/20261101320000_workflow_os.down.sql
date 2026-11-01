-- Reverse of 20261101320000_workflow_os.sql: back to QZ-36's direct-notify triggers and
-- QZ-35's standalone maintenance schedule. Workflow history is dropped.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $q$select cron.unschedule(jobid) from cron.job where jobname='qz-workflows'$q$;
  perform cron.schedule('qz-maintenance','*/15 * * * *',$job$select private.maintenance('cron')$job$);
 end if;
end$$;
create or replace function public.qz_command(command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform private.rate_command();
 -- Explorer mode: a locked session may only play.
 if private.locked() and command not in ('create','transition','answer','plan','blueprint','hint','report','presence','explorer_lock') then
  raise exception 'Explorer mode is on. A grown-up can unlock it with their password.';
 end if;
 if command='explorer_lock' then
  return private.explorer_lock();
 end if;
 if command='account_delete' then
  perform private.member_offboard();
  return private.family_command(command,payload);
 elsif command in ('child_update','child_archive','child_delete','export') then
  return private.family_command(command,payload);
 elsif command like 'sz\_%' then
  return private.safezone_command(command,payload);
 elsif command='cms_country' then
  return private.cms_country(payload);
 elsif command like 'cms\_%' then
  return private.cms_command(command,payload);
 elsif command like 'member\_%' then
  return private.member_command(command,payload);
 elsif command='presence' then
  return private.presence(payload);
 elsif command='create' and (payload->>'practice')='true' then
  r:=private.command(command,payload-'practice');
  perform private.mark_practice((r->>'session')::uuid);
  return r;
 elsif command='consent_accept' then
  return private.consent_accept(payload);
 elsif command='q_budget' then
  return private.q_budget(payload);
 elsif command='notice_read' then
  return private.notice_read(payload);
 end if;
 return private.command(command,payload);
end$$;
drop trigger wf_emit_report on public.moderation_cases;
drop trigger wf_emit_member on public.household_members;
drop trigger wf_emit_child_badge on public.child_badges;
drop trigger wf_emit_household_badge on public.household_badges;
drop trigger wf_emit_consent on public.consent_versions;
drop trigger wf_emit_game on public.game_sessions;
drop function public.qz_workflows();
drop function private.wf_command(text,jsonb);
drop function private.wf_overview();
drop function private.wf_tick(integer);
drop function private.wf_emit(text,uuid,uuid,jsonb,text);
drop function private.wf_dispatch(bigint);
drop function private.wf_execute(bigint);
drop function private.wf_emit_domain();
drop function private.wf_action(text,private.wf_events);
drop table private.wf_steps;
drop table private.wf_runs;
drop table private.wf_events;
drop table private.wf_definitions;
drop function private.wf_scrub(text);
drop function private.wf_check_definition();
drop function private.wf_known_action(text);
delete from public.family_notifications where kind='member_game';
drop index public.family_notifications_once;
create unique index family_notifications_once on public.family_notifications(household_id, kind, ref) where ref is not null and kind in ('game_night','consent_update','badge');
alter table public.family_notifications drop constraint family_notifications_kind_check;
alter table public.family_notifications add constraint family_notifications_kind_check
 check (kind in ('report_status','member_joined','member_left','game_night','consent_update','badge'));
create function private.notify_report() returns trigger language plpgsql security definer set search_path='' as $$begin
 if NEW.status is distinct from OLD.status then
  perform private.notify(NEW.household_id,'report_status',
   case NEW.status when 'under_review' then 'A report is being reviewed' when 'actioned' then 'A report led to a change'
    when 'dismissed' then 'A report was reviewed: no change needed' else 'A report was escalated for more review' end,
   'Thank you for helping keep QuiZone safe.','/parent',null);
 end if;
 return NEW;
end$$;
create trigger notify_report after update of status on public.moderation_cases for each row execute function private.notify_report();
create function private.notify_member() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='INSERT' then
  perform private.notify(NEW.household_id,'member_joined',NEW.display_name||' joined your family','They can host and play games on their own device.','/family',null);
  return NEW;
 end if;
 perform private.notify(OLD.household_id,'member_left',OLD.display_name||' no longer has access','','/family',null);
 return OLD;
end$$;
create trigger notify_member after insert or delete on public.household_members for each row execute function private.notify_member();
create function private.notify_badge() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid; who text; nm text;
begin
 select name into nm from public.badges where code=NEW.badge_code;
 if TG_TABLE_NAME='household_badges' then
  perform private.notify(NEW.household_id,'badge','Family badge: '||nm,'','/passport',private.badge_ref(NEW.household_id,NEW.badge_code));
 else
  select household_id, nickname into h, who from public.child_profiles where id=NEW.child_id;
  perform private.notify(h,'badge',who||' earned '||nm,'','/passport',private.badge_ref(NEW.child_id,NEW.badge_code));
 end if;
 return NEW;
end$$;
create trigger notify_child_badge after insert on public.child_badges for each row execute function private.notify_badge();
create trigger notify_household_badge after insert on public.household_badges for each row execute function private.notify_badge();
create function private.notify_consent() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.family_notifications(household_id,kind,title,body,link,ref)
  select h.id,'consent_update','Updated family consent to review',left(NEW.summary,300),'/parent',private.badge_ref(h.id,'consent:'||NEW.version)
  from public.households h where h.consent_version<NEW.version
 on conflict do nothing;
 return NEW;
end$$;
create trigger notify_consent after insert on public.consent_versions for each row execute function private.notify_consent();
revoke all on function private.notify_report(), private.notify_member(), private.notify_badge(), private.notify_consent() from public, anon, authenticated;
