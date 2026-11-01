# Rollback scripts (operator-only, destructive)

Reverse scripts for the migrations added after the pilot. They are **not** in
`supabase/migrations/`, so the CLI never runs them. Run them only against a
disposable or UAT database, newest first, inside one transaction:

```bash
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 -f supabase/rollback/20261101150000_hardening.down.sql
```

Each script removes its feature's tables and **their data**. Rolling back
`quickzone_scoring` leaves previously awarded bonus points inside
`game_sessions.total_score`. Rolling back `family_controls` restores the original
command router. After a rollback, also delete the matching row from
`supabase_migrations.schema_migrations` so the CLI can re-apply it.

`tests/rollback.test.ts` proves each down → up cycle restores a working schema.
