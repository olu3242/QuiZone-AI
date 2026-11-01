import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-35: one idempotent maintenance job; admin can run it; every run is recorded.
const G = "a8111111-1111-4111-8111-111111111111",
  A = "a8222222-2222-4222-8222-222222222222";
let h: Awaited<ReturnType<typeof harness>>;
const run = async (u: string) =>
  (
    (await h.as(u, "select public.qz_maintenance() r")).rows[0] as {
      r: Record<string, number>;
    }
  ).r;
const n = async (sql: string, p: unknown[] = []) =>
  Number((await h.one<{ n: number }>(sql, p)).n);

before(async () => {
  h = await harness([
    [G, true],
    [A, true],
  ]);
  await h.db.query(
    "insert into private.staff(user_id,role) values($1,'admin')",
    [A],
  );
  await h.cmd(G, "household", { name: "Ops Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Juno",
    age: 10,
    avatar: "owl",
    interest: "science",
  });
});
after(async () => {
  await h.db.close();
});

test("maintenance expires stale games, prunes old rows, and sends reminders once", async () => {
  const kid = (
    await h.one<{ id: string }>("select id from public.child_profiles")
  ).id;
  const quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick' limit 1",
    )
  ).id;
  const { session } = (await h.cmd(G, "create", {
    challenge: quick,
    children: [kid],
  })) as { session: string };
  await h.db.query(
    "update public.game_sessions set expires_at=now()-interval '1 minute' where id=$1",
    [session],
  );
  const { code } = (await h.cmd(G, "member_invite", {})) as { code: string };
  void code;
  await h.db.query(
    "update public.household_invites set expires_at=now()-interval '8 days'",
  );
  await h.db.query(
    "insert into private.explorer_locks(session_id,user_id,locked_at) values(gen_random_uuid(),$1,now()-interval '31 days')",
    [G],
  );
  await h.db.query(
    "insert into private.rate_events(uid,bucket,at) values($1,'export',now()-interval '2 days')",
    [G],
  );
  await h.cmd(G, "schedule", {
    at: new Date(Date.now() + 6 * 3600e3).toISOString(),
    mode: "quick",
  });
  await h.cmd(G, "schedule", {
    at: new Date(Date.now() + 5 * 86400e3).toISOString(),
    mode: "world",
  });

  const r = await run(A);
  assert.equal(r.expiredSessions, 1);
  assert.equal(r.invites, 1);
  assert.equal(r.locks, 1);
  assert.ok(r.rateEvents >= 1);
  assert.equal(r.reminders, 1);
  assert.equal(
    (
      await h.one<{ state: string }>(
        "select state from public.game_sessions where id=$1",
        [session],
      )
    ).state,
    "expired",
  );
  assert.equal(
    await n(
      "select count(*) n from public.family_notifications where kind='game_night'",
    ),
    1,
  );
  // Idempotent: a second run finds nothing new and sends no second reminder.
  const again = await run(A);
  assert.deepEqual(
    [again.expiredSessions, again.invites, again.locks, again.reminders],
    [0, 0, 0, 0],
  );
  assert.equal(
    await n(
      "select count(*) n from public.family_notifications where kind='game_night'",
    ),
    1,
  );
});

test("only administrators run it or see the run log; cron runs are recorded too", async () => {
  await assert.rejects(() => run(G), /administrator/);
  await assert.rejects(
    () => h.as(G, "select public.qz_maintenance_runs()"),
    /administrator/,
  );
  await assert.rejects(
    () => h.as(G, "select private.maintenance('cron')"),
    /permission denied/,
  );
  await h.db.query("select private.maintenance('cron')");
  const log = (
    (await h.as(A, "select public.qz_maintenance_runs() r")).rows[0] as {
      r: { source: string; result: Record<string, number> }[];
    }
  ).r;
  assert.deepEqual(log.map((x) => x.source).slice(0, 3), [
    "cron",
    "operator",
    "operator",
  ]);
  assert.ok(!JSON.stringify(log).includes(G));
});
