-- Reverse of 20261101300000_ops_automation.sql. Leaves the pg_cron extension installed
-- (it may serve other jobs) but removes QuiZone's schedule.
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  -- Nested: cron.job only parses where the extension exists.
  execute $q$select cron.unschedule(jobid) from cron.job where jobname='qz-maintenance'$q$;
 end if;
end$$;
drop function public.qz_maintenance_runs();
drop function public.qz_maintenance();
drop function private.maintenance_runs();
drop function private.maintenance_now();
drop function private.maintenance(text);
drop table private.maintenance_runs;
alter table public.game_nights drop column reminded_at;
