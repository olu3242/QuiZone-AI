drop function public.qz_cms_version(uuid);
drop function private.cms_version(uuid);
drop function private.quality_issues(uuid);
drop trigger versions_supersede on public.challenge_versions;
drop function private.retire_superseded();
create or replace function private.immutable_content() returns trigger language plpgsql set search_path='' as $$begin
 if TG_TABLE_NAME='challenge_versions' then
  if OLD.status in ('published','retired') then raise exception 'Published versions are immutable';end if;
 else
  if exists(select 1 from public.challenge_versions where id=OLD.version_id and status in ('published','retired')) then raise exception 'Published steps are immutable';end if;
 end if;return NEW;end$$;
create or replace function private.cms_command(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ref uuid;
begin
 if uid is null or not private.is_staff('admin') then raise exception 'Content tools require an administrator role';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid command payload';end if;
 if command='cms_meta' then
  update public.challenges set subject=payload->>'subject', difficulty=payload->>'difficulty' where id=(payload->>'challenge')::uuid returning id into ref;
  if ref is null then raise exception 'Challenge not found';end if;
 else raise exception 'Unknown command';end if;
 insert into public.audit_events(household_id,actor,action,reference_id) values(null,uid,command,ref);
 return '{}'::jsonb;
end$$;
