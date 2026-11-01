-- QZ-23: content quality is a publish gate, enforced in the database for every path.
create function private.quality_gate() returns trigger language plpgsql security definer set search_path='' as $$
declare issues text[];
begin
 issues:=private.quality_issues(NEW.id);
 if coalesce(array_length(issues,1),0)>0 then
  raise exception 'Quality check failed: %', array_to_string(issues,'; ');
 end if;
 return NEW;
end$$;
create trigger versions_quality_gate before update of status on public.challenge_versions
 for each row when (NEW.status='published' and OLD.status is distinct from 'published')
 execute function private.quality_gate();
revoke all on function private.quality_gate() from public, anon, authenticated;
