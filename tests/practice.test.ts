import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "d8888888-8888-4888-8888-888888888888",
  O = "d9999999-9999-4999-8999-999999999999";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string;
const mode = async (m: string) =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode=$1",
      [m],
    )
  ).id;
async function finish(session: string) {
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  const steps = await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const s of steps)
    await h.cmd(G, "answer", { session, step: s.id, choice: 0 });
}
const n = async (sql: string, p: unknown[] = []) =>
  Number((await h.one<{ n: string }>(sql, p)).n);

before(async () => {
  h = await harness([
    [G, true],
    [O, true],
  ]);
  await h.cmd(G, "household", { name: "Practice Crew", consent: true });
  await h.cmd(O, "household", { name: "Other Crew", consent: true });
  await h.cmd(G, "permissions", { world: true, q: false, minutes: 60 });
  await h.cmd(G, "child", {
    nickname: "Pip",
    age: 10,
    avatar: "fox",
    interest: "world",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
});
after(async () => {
  await h.db.close();
});

test("a practice round plays fully and keeps its answers and score", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await mode("world"),
    children: [kid],
    practice: true,
  })) as { session: string };
  assert.equal(
    (
      await h.one<{ practice: boolean }>(
        "select practice from public.game_sessions where id=$1",
        [session],
      )
    ).practice,
    true,
  );
  await finish(session);
  const g = await h.one<{ state: string; total_score: number }>(
    "select state,total_score from public.game_sessions where id=$1",
    [session],
  );
  assert.equal(g.state, "complete");
  assert.ok(g.total_score > 0);
  assert.equal(
    await n(
      "select count(*) n from public.player_answers where session_id=$1",
      [session],
    ),
    3,
  );
});

test("practice never records XP, stamps, or badges", async () => {
  assert.equal(
    await n("select count(*) n from public.score_events where child_id=$1", [
      kid,
    ]),
    0,
  );
  assert.equal(
    await n(
      "select count(*) n from public.passport_entries where child_id=$1",
      [kid],
    ),
    0,
  );
  assert.equal(
    await n("select count(*) n from public.child_badges where child_id=$1", [
      kid,
    ]),
    0,
  );
  assert.equal(await n("select count(*) n from public.household_badges"), 0);
});

test("a real round afterwards records progression as normal", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await mode("quick"),
    children: [kid],
  })) as { session: string };
  await finish(session);
  assert.equal(
    await n("select count(*) n from public.score_events where child_id=$1", [
      kid,
    ]),
    1,
  );
  assert.ok(
    (await n("select count(*) n from public.child_badges where child_id=$1", [
      kid,
    ])) >= 2,
  );
});

test("practice can't be applied to someone else's or an in-progress session", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await mode("quick"),
    children: [kid],
  })) as { session: string };
  await assert.rejects(
    () => h.as(O, "select private.mark_practice($1)", [session]),
    /permission denied/,
  );
  await h.cmd(G, "transition", { session, state: "ready" });
  await assert.rejects(
    () => h.as(G, "select private.mark_practice($1)", [session]),
    /permission denied/,
  );
  assert.equal(
    (
      await h.one<{ practice: boolean }>(
        "select practice from public.game_sessions where id=$1",
        [session],
      )
    ).practice,
    false,
  );
});
