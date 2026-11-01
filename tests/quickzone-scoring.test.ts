import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "e5555555-5555-4555-8555-555555555555";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string, quick: string, solve: string;
type Step = { id: string; correct: number; options: string[] };
async function start(challenge: string) {
  const { session } = (await h.cmd(G, "create", {
    challenge,
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  const steps = await h.rows<Step>(
    "select s.id,k.correct,s.options from public.challenge_steps s join private.answer_keys k on k.step_id=s.id join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  return { session, steps };
}
const answer = (session: string, step: Step, right: boolean) =>
  h.cmd(G, "answer", {
    session,
    step: step.id,
    choice: right ? step.correct : (step.correct + 1) % step.options.length,
  });
const saved = (session: string) =>
  h.rows<{
    points: number;
    bonus: number;
    elapsed_ms: number;
    feedback: string;
  }>(
    "select a.points,a.bonus,a.elapsed_ms,a.feedback from public.player_answers a join public.challenge_steps s on s.id=a.step_id where a.session_id=$1 order by s.ordinal",
    [session],
  );
const total = async (session: string) =>
  (
    await h.one<{ total_score: number }>(
      "select total_score from public.game_sessions where id=$1",
      [session],
    )
  ).total_score;

before(async () => {
  h = await harness([[G, true]]);
  await h.cmd(G, "household", { name: "Speed Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Zip",
    age: 11,
    avatar: "rocket",
    interest: "science",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
  quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  ).id;
  solve = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='solve'",
    )
  ).id;
});
after(async () => {
  await h.db.close();
});

test("speed bonus depends on the server step clock, never on client input", async () => {
  const { session, steps } = await start(quick);
  // Simulate a slow first step (50s) and a medium second step (30s).
  await h.db.query(
    "update public.game_sessions set step_started_at=now()-interval '50 seconds' where id=$1",
    [session],
  );
  await answer(session, steps[0], true);
  await h.db.query(
    "update public.game_sessions set step_started_at=now()-interval '30 seconds' where id=$1",
    [session],
  );
  await answer(session, steps[1], true);
  await answer(session, steps[2], true);
  const a = await saved(session);
  assert.ok(a[0].elapsed_ms >= 50000);
  assert.deepEqual(
    a.map((x) => x.bonus),
    [0, 10 + 10, 20 + 20],
  );
  assert.match(a[2].feedback, /Bonus \+40 \(speed \+20\) \(streak \+20\)/);
  assert.equal(await total(session), 300 + 20 + 40);
  const scores = await h.rows<{ points: number }>(
    "select points from public.score_events where session_id=$1",
    [session],
  );
  assert.equal(scores[0].points, 360);
});

test("a wrong answer earns participation only and resets the streak", async () => {
  const { session, steps } = await start(quick);
  await answer(session, steps[0], true);
  await answer(session, steps[1], false);
  await answer(session, steps[2], true);
  const a = await saved(session);
  assert.deepEqual(
    a.map((x) => [x.points, x.bonus]),
    [
      [120, 20],
      [25, 0],
      [120, 20],
    ],
  );
  assert.equal(await total(session), 265);
});

test("pausing restarts the clock on resume; totals always equal saved points", async () => {
  const { session, steps } = await start(quick);
  await h.cmd(G, "transition", { session, state: "paused" });
  await h.db.query(
    "update public.game_sessions set step_started_at=now()-interval '10 minutes' where id=$1",
    [session],
  );
  await h.cmd(G, "transition", { session, state: "active" });
  await answer(session, steps[0], true);
  const a = await saved(session);
  assert.equal(a[0].bonus, 20);
  const sum = await h.one<{ s: number }>(
    "select sum(points)::int s from public.player_answers where session_id=$1",
    [session],
  );
  assert.equal(await total(session), sum.s);
});

test("bonuses apply to QuickZone only and cannot be written by clients", async () => {
  const { session, steps } = await start(solve);
  await h.cmd(G, "plan", {
    session,
    step: steps[0].id,
    allocation: {
      solar: 35000,
      wind: 30000,
      battery: 20000,
      diesel: 0,
      grid: 0,
      efficiency: 10000,
    },
  });
  await answer(session, steps[1], true);
  const a = await saved(session);
  assert.deepEqual(
    a.map((x) => x.bonus),
    [0, 0],
  );
  await assert.rejects(
    () =>
      h.as(G, "update public.player_answers set bonus=50 where session_id=$1", [
        session,
      ]),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      h.as(
        G,
        "update public.game_sessions set step_started_at=now() where id=$1",
        [session],
      ),
    /permission denied/,
  );
});
