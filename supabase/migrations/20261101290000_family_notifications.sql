-- QZ-36: a family inbox in the Parent Hub (additive). Guardian-only (read through
-- private.owns, so a locked Explorer-mode session sees none of it). Every row is
-- written by a trigger or the maintenance job from data the database already holds —
-- never by the client.
create table public.family_notifications(
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households on delete cascade,
 kind text not null check (kind in ('report_status','member_joined','member_left','game_night','consent_update','badge')),
 title text not null check (length(title) between 3 and 120),
 body text not null default '' check (length(body) <= 300),
 link text check (link is null or link ~ '^/[a-z/0-9-]*$'),
 ref uuid,
 created_at timestamptz not null default now(),
 read_at timestamptz);
create index family_notifications_inbox on public.family_notifications(household_id, created_at desc);
-- One notice per (kind, ref) where a ref exists: re-runs never duplicate.
create unique index family_notifications_once on public.family_notifications(household_id, kind, ref) where ref is not null and kind in ('game_night','consent_update','badge');
alter table public.family_notifications enable row level security;
revoke all on public.family_notifications from anon, authenticated;
grant select on public.family_notifications to authenticated;
create policy own_notifications on public.family_notifications for select to authenticated using(private.owns(household_id));

create function private.notify(h uuid, k text, t text, b text, l text, r uuid) returns void language plpgsql security definer set search_path='' as $$begin
 -- Skip households already being deleted (cascades fire after the parent row is gone).
 if not exists(select 1 from public.households where id=h) then return; end if;
 insert into public.family_notifications(household_id,kind,title,body,link,ref) values(h,k,t,coalesce(b,''),l,r) on conflict do nothing;
end$$;

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
-- Stable ref for a (holder, badge) pair so a badge notice is never repeated.
create function private.badge_ref(holder uuid, code text) returns uuid language sql immutable set search_path='' as $$
 select (substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid
 from (select md5(holder::text||':'||code) h) x$$;
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

-- Mark one notice, or all, as read. Guardian only.
create function private.notice_read(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; n int;
begin
 select id into hid from public.households where guardian_id=uid;
 if hid is null then raise exception 'Only the guardian can manage the family inbox';end if;
 if (payload->>'all')='true' then
  update public.family_notifications set read_at=now() where household_id=hid and read_at is null;
 else
  update public.family_notifications set read_at=coalesce(read_at,now()) where household_id=hid and id=(payload->>'id')::uuid;
  get diagnostics n=row_count;
  if n=0 then raise exception 'Notice not found';end if;
 end if;
 return '{}'::jsonb;
end$$;
revoke all on function private.notify(uuid,text,text,text,text,uuid), private.notify_report(), private.notify_member(), private.notify_badge(), private.notify_consent(), private.badge_ref(uuid,text), private.notice_read(jsonb) from public, anon, authenticated;
grant execute on function private.notice_read(jsonb) to authenticated;

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
