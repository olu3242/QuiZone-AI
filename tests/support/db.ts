import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
// Real migrations on real PostgreSQL (PGlite) with stubbed Supabase Auth identity.
export async function harness(users: [string, boolean][]) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const [id, confirmed] of users)
    await db.query("insert into auth.users values($1,$2)", [
      id,
      confirmed ? new Date() : null,
    ]);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  async function as(user: string | null, sql: string, params: unknown[] = []) {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user || "",
    ]);
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("reset role");
    }
  }
  async function cmd(user: string | null, action: string, data: unknown) {
    const r = await as(
      user,
      "select public.qz_command($1,$2::jsonb) as result",
      [action, JSON.stringify(data)],
    );
    return (r.rows[0] as { result: Record<string, unknown> }).result;
  }
  async function rows<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) {
    return (await db.query<T>(sql, params)).rows;
  }
  async function one<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ) {
    return (await rows<T>(sql, params))[0];
  }
  return { db, as, cmd, rows, one };
}
