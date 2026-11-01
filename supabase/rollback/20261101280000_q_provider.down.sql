-- Reverse of 20261101280000_q_provider.sql.
drop function public.qz_q_suggest_log(uuid,text,integer);
drop function private.q_suggest_log(uuid,text,integer);
create or replace function private.rate_check(bucket text) returns void language plpgsql security definer set search_path='' as $$begin
 case bucket
  when 'reauth' then perform private.rate_limit('reauth', 10, 900);   -- password re-verification
  when 'export' then perform private.rate_limit('export', 5, 3600);   -- data export
  else raise exception 'Unknown rate bucket';
 end case;
end$$;
delete from private.feature_flags where flag='q_live';
