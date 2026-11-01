import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "ab111111-1111-4111-8111-111111111111",
  MOD = "ab222222-2222-4222-8222-222222222222";
let h: Awaited<ReturnType<typeof harness>>;
const overview = async (u: string) =>
  ((await h.as(u, "select public.qz_ops_overview() o")).rows[0] as { o: any })
    .o;

before(async () => {
  h = await harness([
    [G, true],
    [MOD, true],
  ]);
  await h.db.query("insert into private.staff values($1,'moderator')", [MOD]);
  await h.cmd(G, "household", { name: "Ops Crew Secret Name", consent: true });
  await h.cmd(G, "child", {
    nickname: "Hidden Nick",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  const kid = (
    await h.one<{ id: string }>("select id from public.child_profiles")
  ).id;
  const quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  ).id;
  const { session } = (await h.cmd(G, "create", {
    challenge: quick,
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "report", { session, reason: "technical" });
});
after(async () => {
  await h.db.close();
});

test("guardians cannot read the operations overview", async () => {
  await assert.rejects(() => overview(G), /staff role/);
});

test("staff see accurate aggregates", async () => {
  const o = await overview(MOD);
  assert.equal(o.households, 1);
  assert.deepEqual(o.explorers, { active: 1, archived: 0 });
  assert.deepEqual(o.sessions7d, { lobby: 1 });
  assert.equal(o.openGameReports, 1);
  assert.equal(o.flags.safezone, false);
  assert.equal(o.consent.current, 1);
  assert.equal(o.consent.householdsPending, 0);
  assert.ok(o.publishedChallenges >= 5);
  assert.ok(
    (o.rateLimitHits1h.command ?? 0) >= 3,
    "command metering is visible",
  );
});

test("the overview carries no personal data or identifiers", async () => {
  const text = JSON.stringify(await overview(MOD));
  for (const secret of ["Ops Crew Secret Name", "Hidden Nick", G, MOD])
    assert.equal(text.includes(secret), false, secret);
  assert.doesNotMatch(
    text,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    "no UUIDs",
  );
});
