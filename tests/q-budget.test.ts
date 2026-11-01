import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "ac111111-1111-4111-8111-111111111111",
  O = "ac222222-2222-4222-8222-222222222222";
let h: Awaited<ReturnType<typeof harness>>;
const usage = async (u: string) =>
  (
    (await h.as(u, "select public.qz_q_usage() q")).rows[0] as {
      q: { used: number; limit: number };
    }
  ).q;
async function activeSession(user: string) {
  const kid = (
    await h.one<{ id: string }>(
      "select c.id from public.child_profiles c join public.households x on x.id=c.household_id where x.guardian_id=$1",
      [user],
    )
  ).id;
  const quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  ).id;
  await h.db.query(
    "update public.game_sessions set state='cancelled' where household_id=(select id from public.households where guardian_id=$1)",
    [user],
  );
  const { session } = (await h.cmd(user, "create", {
    challenge: quick,
    children: [kid],
  })) as { session: string };
  await h.cmd(user, "transition", { session, state: "ready" });
  await h.cmd(user, "transition", { session, state: "active" });
  return session;
}

before(async () => {
  h = await harness([
    [G, true],
    [O, true],
  ]);
  for (const [u, n] of [
    [G, "Hint Crew"],
    [O, "Other Crew"],
  ] as const) {
    await h.cmd(u, "household", { name: n, consent: true });
    await h.cmd(u, "child", {
      nickname: "Q" + n.slice(0, 3),
      age: 10,
      avatar: "owl",
      interest: "science",
    });
    await h.cmd(u, "permissions", { world: false, q: true, minutes: 60 });
  }
});
after(async () => {
  await h.db.close();
});

test("the default daily limit is 20 and hints are attributed to the household", async () => {
  assert.deepEqual(await usage(G), { used: 0, limit: 20 });
  const s = await activeSession(G);
  await h.cmd(G, "hint", { session: s });
  assert.deepEqual(await usage(G), { used: 1, limit: 20 });
  const hid = (
    await h.one<{ id: string }>(
      "select id from public.households where guardian_id=$1",
      [G],
    )
  ).id;
  assert.equal(
    (
      await h.one<{ household_id: string }>(
        "select household_id from public.ai_evaluations limit 1",
      )
    ).household_id,
    hid,
  );
});

test("the guardian's daily limit is enforced across sessions and refreshes after 24h", async () => {
  await h.cmd(G, "q_budget", { limit: 2 });
  const s = await activeSession(G);
  await h.cmd(G, "hint", { session: s });
  await assert.rejects(
    () => h.cmd(G, "hint", { session: s }),
    /used today's 2 guided hints/,
  );
  await h.db.query(
    "update public.ai_evaluations set created_at=now()-interval '25 hours'",
  );
  await h.cmd(G, "hint", { session: s });
});

test("limits are per household, validated, audited, and not client-writable", async () => {
  const s = await activeSession(O);
  await h.cmd(O, "hint", { session: s });
  assert.equal((await usage(O)).used, 1);
  await assert.rejects(
    () => h.cmd(G, "q_budget", { limit: 500 }),
    /check constraint/,
  );
  await assert.rejects(
    () => h.cmd(G, "q_budget", { limit: "lots" }),
    /daily hint limit/,
  );
  await assert.rejects(
    () => h.as(G, "update public.guardian_permissions set q_daily_limit=50"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(G, "update public.ai_evaluations set household_id=null"),
    /permission denied/,
  );
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.audit_events where actor=$1 and action='q_budget'",
          [G],
        )
      ).n,
    ),
    1,
  );
});
