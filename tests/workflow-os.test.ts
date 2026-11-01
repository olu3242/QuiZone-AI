import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-39: the Workflow OS — outbox, versioned definitions, runtime, retries, dead letters.
const G = "aa111111-1111-4111-8111-111111111111",
  M = "aa222222-2222-4222-8222-222222222222",
  A = "aa333333-3333-4333-8333-333333333333";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string, hid: string;
const n = async (sql: string, p: unknown[] = []) =>
  Number((await h.one<{ n: number }>(sql, p)).n);
type Run = {
  id: number;
  workflow: string;
  event: string;
  status: string;
  attempt: number;
  error: string | null;
  steps: {
    action: string;
    attempt: number;
    status: string;
    error: string | null;
  }[];
};
type Overview = {
  definitions: {
    key: string;
    version: number;
    enabled: boolean;
    steps: string[];
  }[];
  runs: Run[];
  deadLetters: number;
};
const overview = async () =>
  ((await h.as(A, "select public.qz_workflows() r")).rows[0] as { r: Overview })
    .r;
const tick = () => h.cmd(A, "wf_tick", {});
const emit = (key: string, name = "Test") =>
  h.db.query(
    `select private.wf_emit('member.joined',$1,null,jsonb_build_object('name',$2::text),$3)`,
    [hid, name, key],
  );
const latest = async (key: string) =>
  await h.one<{
    id: number;
    status: string;
    attempt: number;
    last_error: string | null;
  }>(
    "select r.id,r.status,r.attempt,r.last_error from private.wf_runs r join private.wf_events e on e.id=r.event_id where e.idempotency_key=$1",
    [key],
  );
// Fault injection: make the inbox reject the next notice, the way a real outage would.
const breakInbox = () =>
  h.db.query(
    "alter table public.family_notifications add constraint wf_test_outage check (title <> 'Test joined your family') not valid",
  );
const fixInbox = () =>
  h.db.query(
    "alter table public.family_notifications drop constraint wf_test_outage",
  );

before(async () => {
  h = await harness([
    [G, true],
    [M, true],
    [A, true],
  ]);
  await h.db.query(
    "insert into private.staff(user_id,role) values($1,'admin')",
    [A],
  );
  await h.cmd(G, "household", { name: "Flow Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Pax",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
  hid = (await h.one<{ id: string }>("select id from public.households")).id;
});
after(async () => {
  await h.db.close();
});

test("definitions are versioned data that may only name whitelisted actions", async () => {
  const o = await overview();
  const keys = o.definitions.map((d) => d.key);
  for (const k of [
    "badge.notify",
    "member.joined.notify",
    "report.status.notify",
    "consent.notify",
    "game.member_hosted.notify",
    "ops.maintenance",
  ])
    assert.ok(keys.includes(k), k);
  await assert.rejects(
    () =>
      h.db.query(
        `insert into private.wf_definitions(key,version,event,steps,description) values('evil.flow',1,'badge.awarded','["drop_everything"]','Tries to name an action outside the whitelist.')`,
      ),
    /unknown action/,
  );
  // A new version becomes the live one.
  await h.db.query(
    `insert into private.wf_definitions(key,version,event,steps,description) values('badge.notify',2,'badge.awarded','["notify_badge"]','Version two of the badge notice workflow.')`,
  );
  assert.equal(
    (await overview()).definitions.find((d) => d.key === "badge.notify")
      ?.version,
    2,
  );
});

test("domain events run inline, once per idempotency key, with a step log", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: (
      await h.one<{ id: string }>(
        "select id from public.challenges where mode='quick' limit 1",
      )
    ).id,
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  for (const s of await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  ))
    await h.cmd(G, "answer", { session, step: s.id, choice: 0 });
  const o = await overview();
  const badgeRuns = o.runs.filter((r) => r.workflow === "badge.notify");
  assert.ok(badgeRuns.length >= 2);
  assert.ok(
    badgeRuns.every(
      (r) => r.status === "succeeded" && r.steps[0].action === "notify_badge",
    ),
  );
  // game.completed ran too: guardian-hosted, so the step reports a skip.
  assert.ok(
    o.runs.some(
      (r) =>
        r.workflow === "game.member_hosted.notify" && r.status === "succeeded",
    ),
  );
  assert.ok(
    (await n(
      "select count(*) n from public.family_notifications where kind='badge'",
    )) >= 2,
  );
  // Same idempotency key: no second event, no second run.
  await emit("test:dup");
  await emit("test:dup");
  assert.equal(
    await n(
      "select count(*) n from private.wf_events where idempotency_key='test:dup'",
    ),
    1,
  );
  assert.equal(
    await n(
      "select count(*) n from private.wf_runs r join private.wf_events e on e.id=r.event_id where e.idempotency_key='test:dup'",
    ),
    1,
  );
});

test("a failing step is retried with backoff and then succeeds", async () => {
  await breakInbox();
  await emit("test:retry");
  let r = await latest("test:retry");
  assert.equal(r.status, "failed");
  assert.equal(r.attempt, 1);
  assert.match(String(r.last_error), /wf_test_outage/);
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}/.test(String(r.last_error)),
    "errors are scrubbed of ids",
  );
  // Not due yet: the tick leaves it alone.
  await tick();
  assert.equal((await latest("test:retry")).attempt, 1);
  await fixInbox();
  await h.db.query(
    "update private.wf_runs set next_attempt_at=now() where id=$1",
    [r.id],
  );
  await tick();
  r = await latest("test:retry");
  assert.equal(r.status, "succeeded");
  assert.equal(r.attempt, 2);
  const run = (await overview()).runs.find((x) => x.id === r.id)!;
  assert.deepEqual(
    run.steps.map((s) => [s.attempt, s.status]),
    [
      [1, "failed"],
      [2, "succeeded"],
    ],
  );
});

test("runs that exhaust their attempts go to the dead-letter queue; an admin can retry them", async () => {
  await breakInbox();
  await emit("test:dead");
  for (let i = 0; i < 5; i++) {
    await h.db.query(
      "update private.wf_runs set next_attempt_at=now() from private.wf_events e where e.id=event_id and e.idempotency_key='test:dead'",
    );
    await tick();
  }
  const r = await latest("test:dead");
  assert.equal(r.status, "dead");
  assert.equal(r.attempt, 5);
  assert.equal((await overview()).deadLetters, 1);
  await fixInbox();
  await h.cmd(A, "wf_retry", { run: r.id });
  await tick();
  assert.equal((await latest("test:dead")).status, "succeeded");
  await assert.rejects(
    () => h.cmd(A, "wf_retry", { run: r.id }),
    /Only failed or dead/,
  );
});

test("pausing queues runs without executing them; resuming releases them", async () => {
  await h.cmd(A, "wf_pause", { workflow: "member.joined.notify" });
  const before = await n(
    "select count(*) n from public.family_notifications where kind='member_joined'",
  );
  await emit("test:paused", "Paused");
  assert.equal((await latest("test:paused")).status, "paused");
  await tick();
  assert.equal(
    await n(
      "select count(*) n from public.family_notifications where kind='member_joined'",
    ),
    before,
  );
  await h.cmd(A, "wf_resume", { workflow: "member.joined.notify" });
  await tick();
  assert.equal((await latest("test:paused")).status, "succeeded");
  assert.equal(
    await n(
      "select count(*) n from public.family_notifications where kind='member_joined'",
    ),
    before + 1,
  );
  await assert.rejects(
    () => h.cmd(A, "wf_pause", { workflow: "no.such" }),
    /Workflow not found/,
  );
});

test("the clock emits once per quarter hour and runs maintenance as a workflow", async () => {
  // Earlier ticks in this quarter hour already emitted it; more ticks must not.
  await tick();
  const runs0 = await n("select count(*) n from private.maintenance_runs");
  await tick();
  await tick();
  assert.equal(
    await n(
      "select count(*) n from private.wf_events where type='clock.quarter_hour'",
    ),
    1,
  );
  assert.equal(
    await n("select count(*) n from private.maintenance_runs"),
    runs0,
  );
  assert.ok(runs0 >= 1);
  const o = await overview();
  assert.ok(
    o.runs.some(
      (r) => r.workflow === "ops.maintenance" && r.status === "succeeded",
    ),
  );
});

test("a game hosted by a family member notifies the guardian", async () => {
  const { code } = (await h.cmd(G, "member_invite", {})) as { code: string };
  await h.cmd(M, "member_join", { code, displayName: "Auntie Ro" });
  const { session } = (await h.cmd(M, "create", {
    challenge: (
      await h.one<{ id: string }>(
        "select id from public.challenges where mode='quick' limit 1",
      )
    ).id,
    children: [kid],
  })) as { session: string };
  await h.cmd(M, "transition", { session, state: "ready" });
  await h.cmd(M, "transition", { session, state: "active" });
  for (const s of await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  ))
    await h.cmd(M, "answer", { session, step: s.id, choice: 0 });
  const notice = await h.one<{ title: string; body: string }>(
    "select title, body from public.family_notifications where kind='member_game'",
  );
  assert.match(notice.title, /^Auntie Ro hosted /);
  assert.match(notice.body, /scored \d+ points/);
});

test("only administrators inspect or steer workflows; nothing identifying leaves the overview", async () => {
  for (const u of [G, M]) {
    await assert.rejects(
      () => h.as(u, "select public.qz_workflows()"),
      /administrator/,
    );
    await assert.rejects(
      () => h.cmd(u, "wf_tick", {}),
      /administrator|guardian/,
    );
  }
  await assert.rejects(
    () => h.as(G, "select * from private.wf_events"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(G, "select private.wf_emit('badge.awarded',null,null,'{}','x')"),
    /permission denied/,
  );
  const text = JSON.stringify(await overview());
  for (const id of [G, M, kid, hid]) assert.ok(!text.includes(id), id);
  assert.ok(!/Pax|Auntie Ro|Flow Crew/.test(text));
  assert.ok(
    (await n(
      "select count(*) n from public.audit_events where action in ('wf_pause','wf_resume','wf_retry','wf_tick')",
    )) >= 4,
  );
});
