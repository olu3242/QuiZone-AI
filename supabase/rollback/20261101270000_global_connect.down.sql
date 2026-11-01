-- Reverse of 20261101270000_global_connect.sql.
drop function public.qz_world_compare(uuid);
drop function private.world_compare(uuid);
delete from private.feature_flags where flag='global_compare';
