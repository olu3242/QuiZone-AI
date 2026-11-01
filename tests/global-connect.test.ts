import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-33: cross-household WorldZone comparisons — aggregate only, k >= 5 households.
const users = Array.from(
  { length: 7 },
  (_, i) => `c${i}000000-0000-4000-8000-00000000000${i}`,
);
let h: Awaited<ReturnType<typeof harness>>;
const kids: string[] = [];
let world: string;

async function play(i: number, choice: number, practice = false) {
  const u = users[i];
  const { session } = (await h.cmd(u, "create", {
    challenge: world,
    children: [kids[i]],
    ...(practice ? { practice: true } : {}),
  })) as { session: string };
  await h.cmd(u, "transition", { session, state: "ready" });
  await h.cmd(u, "transition", { session, state: "active" });
  const steps = await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const s of steps)
    await h.cmd(u, "answer", { session, step: s.id, choice });
  return session;
}
type Compare = {
  enabled: boolean;
  steps: {
    step: number;
    available: boolean;
    yourChoice: number | null;
    distribution: { option: number; percent: number }[] | null;
  }[];
};
const compare = async (i: number, session: string) =>
  (
    (await h.as(users[i], "select public.qz_world_compare($1) r", [session]))
      .rows[0] as { r: Compare }
  ).r;

before(async () => {
  h = await harness(users.map((u) => [u, true] as [string, boolean]));
  world = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='world' limit 1",
    )
  ).id;
  for (const [i, u] of users.entries()) {
    await h.cmd(u, "household", { name: `Globe ${i}`, consent: true });
    await h.cmd(u, "permissions", { world: true, q: false, minutes: 60 });
    await h.cmd(u, "child", {
      nickname: `Kid${i}`,
      age: 11,
      avatar: "owl",
      interest: "world",
    });
    kids.push(
      (
        await h.one<{ id: string }>(
          "select c.id from public.child_profiles c join public.households h on h.id=c.household_id where h.guardian_id=$1",
          [u],
        )
      ).id,
    );
  }
});
after(async () => {
  await h.db.close();
});

test("below five households nothing is shown, and practice rounds don't count", async () => {
  const s0 = await play(0, 0);
  for (let i = 1; i < 4; i++) await play(i, 1);
  await play(4, 1, true); // practice: ignored
  const r = await compare(0, s0);
  assert.equal(r.enabled, true);
  assert.ok(r.steps.length >= 1);
  for (const s of r.steps) {
    assert.equal(s.available, false);
    assert.equal(s.distribution, null);
    assert.equal(s.yourChoice, 0);
  }
});

test("at five households a rounded distribution appears, one vote per household", async () => {
  const s4 = await play(4, 1);
  await play(1, 0); // household 1 replays: only its latest answer counts
  const r = await compare(4, s4);
  for (const s of r.steps) {
    assert.equal(s.available, true);
    const by = Object.fromEntries(
      (s.distribution ?? []).map((d) => [d.option, d.percent]),
    );
    assert.equal(by[0], 40); // households 0 and 1
    assert.equal(by[1], 60); // households 2, 3, 4
    assert.equal(s.yourChoice, 1);
  }
  // No identities: nothing about households, explorers, or sessions.
  const text = JSON.stringify(r);
  for (const id of [...users, ...kids]) assert.ok(!text.includes(id));
  assert.ok(!/Globe|Kid\d/.test(text));
});

test("only the session's own household (or its members) can ask, only for WorldZone", async () => {
  const s0 = (
    await h.one<{ id: string }>(
      "select g.id from public.game_sessions g join public.households h on h.id=g.household_id where h.guardian_id=$1 limit 1",
      [users[0]],
    )
  ).id;
  await assert.rejects(() => compare(5, s0), /permission denied/);
  await assert.rejects(
    () => h.as(null, "select public.qz_world_compare($1)", [s0]),
    /Sign in|permission denied/,
  );
  const quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick' limit 1",
    )
  ).id;
  const { session } = (await h.cmd(users[6], "create", {
    challenge: quick,
    children: [kids[6]],
  })) as { session: string };
  await assert.rejects(
    () => compare(6, session),
    /only available for WorldZone/,
  );
});

test("the operator kill switch turns comparisons off", async () => {
  const s0 = (
    await h.one<{ id: string }>(
      "select g.id from public.game_sessions g join public.households h on h.id=g.household_id where h.guardian_id=$1 limit 1",
      [users[0]],
    )
  ).id;
  await h.db.query(
    "update private.feature_flags set enabled=false where flag='global_compare'",
  );
  assert.deepEqual(await compare(0, s0), { enabled: false });
  await h.db.query(
    "update private.feature_flags set enabled=true where flag='global_compare'",
  );
});
