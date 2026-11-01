import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const A = "a1111111-1111-4111-8111-111111111111",
  B = "b2222222-2222-4222-8222-222222222222",
  STAFF = "c3333333-3333-4333-8333-333333333333",
  LONER = "d4444444-4444-4444-8444-444444444444";
let h: Awaited<ReturnType<typeof harness>>;
let quick: string, solo: string, sibling: string, other: string;
const child = (nickname: string, age = 10) => ({
  nickname,
  age,
  avatar: "fox",
  interest: "science",
});
async function childId(user: string, nickname: string) {
  return (
    await h.one<{ id: string }>(
      "select c.id from public.child_profiles c join public.households h on h.id=c.household_id where h.guardian_id=$1 and c.nickname=$2",
      [user, nickname],
    )
  ).id;
}
async function play(user: string, players: string[]) {
  const { session } = (await h.cmd(user, "create", {
    challenge: quick,
    children: players,
  })) as { session: string };
  await h.cmd(user, "transition", { session, state: "ready" });
  await h.cmd(user, "transition", { session, state: "active" });
  const steps = await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const s of steps)
    await h.cmd(user, "answer", { session, step: s.id, choice: 0 });
  return session;
}
const count = async (sql: string, params: unknown[] = []) =>
  Number((await h.one<{ n: string }>(sql, params)).n);

before(async () => {
  h = await harness([
    [A, true],
    [B, true],
    [STAFF, true],
    [LONER, true],
  ]);
  await h.db.query("insert into private.staff values($1,'moderator')", [STAFF]);
  quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  ).id;
  await h.cmd(A, "household", { name: "Curious Crew", consent: true });
  await h.cmd(B, "household", { name: "Other Crew", consent: true });
  await h.cmd(A, "child", child("Solo Star"));
  await h.cmd(A, "child", child("Sibling One", 12));
  await h.cmd(B, "child", child("Neighbour"));
  solo = await childId(A, "Solo Star");
  sibling = await childId(A, "Sibling One");
  other = await childId(B, "Neighbour");
});
after(async () => {
  await h.db.close();
});

test("guardian edits own explorer; other households and invalid nicknames are rejected", async () => {
  await h.cmd(A, "child_update", {
    child: solo,
    ...child("Solo Comet", 11),
    avatar: "owl",
  });
  const row = await h.one<{ nickname: string; age: number; avatar: string }>(
    "select nickname,age,avatar from public.child_profiles where id=$1",
    [solo],
  );
  assert.deepEqual(row, { nickname: "Solo Comet", age: 11, avatar: "owl" });
  await assert.rejects(
    () => h.cmd(B, "child_update", { child: solo, ...child("Hijack") }),
    /not found or permission denied/,
  );
  await assert.rejects(
    () => h.cmd(A, "child_update", { child: solo, ...child("me@school.org") }),
    /personal contact/,
  );
  await assert.rejects(
    () => h.cmd(A, "child_update", { child: solo, ...child("Tiny", 4) }),
    /check constraint/,
  );
  await h.cmd(A, "child_update", { child: solo, ...child("Solo Star") });
});

test("archived explorers keep history but cannot join new sessions until restored", async () => {
  await h.cmd(A, "child_archive", { child: sibling, archived: true });
  await assert.rejects(
    () => h.cmd(A, "create", { challenge: quick, children: [sibling] }),
    /Archived explorers/,
  );
  await assert.rejects(
    () => h.cmd(A, "child_update", { child: sibling, ...child("Renamed") }),
    /Restore this explorer/,
  );
  await assert.rejects(
    () => h.cmd(B, "child_archive", { child: sibling, archived: false }),
    /permission denied/,
  );
  await assert.rejects(
    () => h.cmd(A, "child_archive", { child: sibling, archived: "yes" }),
    /Invalid archive/,
  );
  await h.cmd(A, "child_archive", { child: sibling, archived: false });
  const r = await h.one<{ archived_at: string | null }>(
    "select archived_at from public.child_profiles where id=$1",
    [sibling],
  );
  assert.equal(r.archived_at, null);
});

test("explorer deletion requires confirmation, blocks open sessions, and removes solo activity only", async () => {
  const soloSession = await play(A, [solo]);
  const sharedSession = await play(A, [solo, sibling]);
  const { session: open } = (await h.cmd(A, "create", {
    challenge: quick,
    children: [solo],
  })) as { session: string };
  await assert.rejects(
    () => h.cmd(A, "child_delete", { child: solo, confirm: "solo star" }),
    /exactly/,
  );
  await assert.rejects(
    () => h.cmd(B, "child_delete", { child: solo, confirm: "Solo Star" }),
    /permission denied/,
  );
  await assert.rejects(
    () => h.cmd(A, "child_delete", { child: solo, confirm: "Solo Star" }),
    /open adventures/,
  );
  await h.cmd(A, "transition", { session: open, state: "cancelled" });
  await h.cmd(A, "report", { session: soloSession, reason: "incorrect" });
  await assert.rejects(
    () => h.cmd(A, "child_delete", { child: solo, confirm: "Solo Star" }),
    /still being reviewed/,
  );
  const caseId = (
    await h.one<{ id: string }>(
      "select id from public.moderation_cases where session_id=$1",
      [soloSession],
    )
  ).id;
  await h.cmd(STAFF, "review", { caseId, status: "dismissed" });
  const result = await h.cmd(A, "child_delete", {
    child: solo,
    confirm: "Solo Star",
  });
  assert.equal(result.deleted, true);
  assert.equal(result.sessions, 2); // the solo session and the cancelled one
  assert.equal(
    await count("select count(*) n from public.child_profiles where id=$1", [
      solo,
    ]),
    0,
  );
  assert.equal(
    await count("select count(*) n from public.game_sessions where id=$1", [
      soloSession,
    ]),
    0,
  );
  assert.equal(
    await count(
      "select count(*) n from public.player_answers where session_id=$1",
      [soloSession],
    ),
    0,
  );
  // Shared session survives for the sibling, minus the deleted explorer's records.
  assert.equal(
    await count(
      "select count(*) n from public.session_players where session_id=$1",
      [sharedSession],
    ),
    1,
  );
  assert.equal(
    await count(
      "select count(*) n from public.score_events where session_id=$1 and child_id=$2",
      [sharedSession, sibling],
    ),
    1,
  );
  assert.equal(
    await count(
      "select count(*) n from public.score_events where child_id=$1",
      [solo],
    ),
    0,
  );
  const audit = await h.rows<{ action: string }>(
    "select action from public.audit_events where actor=$1 and action like 'child_%' order by created_at",
    [A],
  );
  assert.deepEqual(
    audit.map((a) => a.action),
    [
      "child_update",
      "child_update",
      "child_archive",
      "child_archive",
      "child_delete",
    ],
  );
});

test("export is audited and only reads the caller's household under RLS", async () => {
  await h.cmd(B, "export", {});
  const seen = await h.as(B, "select id from public.child_profiles");
  assert.deepEqual(
    seen.rows.map((r) => (r as { id: string }).id),
    [other],
  );
  assert.equal(
    await count(
      "select count(*) n from public.audit_events where actor=$1 and action='export'",
      [B],
    ),
    1,
  );
  await assert.rejects(() => h.cmd(LONER, "export", {}), /household first/);
});

test("new commands reject unconfirmed, anonymous, and direct-table access", async () => {
  await assert.rejects(
    () => h.cmd(null, "child_archive", { child: other, archived: true }),
    /confirmed guardian/,
  );
  await assert.rejects(
    () => h.as(B, "update public.child_profiles set archived_at=now()"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(B, "select private.purge_sessions(array[]::uuid[])"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(B, "select * from private.account_deletions"),
    /permission denied/,
  );
});

test("staff accounts cannot self-delete; wrong confirmation is rejected", async () => {
  await assert.rejects(
    () => h.cmd(STAFF, "account_delete", { confirm: "DELETE" }),
    /Staff accounts/,
  );
  await assert.rejects(
    () => h.cmd(A, "account_delete", { confirm: "curious crew" }),
    /exactly/,
  );
});

test("account deletion erases the household, its activity, and the auth identity only", async () => {
  await play(A, [sibling]);
  const before = {
    bChildren: await count(
      "select count(*) n from public.child_profiles c join public.households h on h.id=c.household_id where h.guardian_id=$1",
      [B],
    ),
    bAudit: await count(
      "select count(*) n from public.audit_events where actor=$1",
      [B],
    ),
  };
  const r = await h.cmd(A, "account_delete", { confirm: "Curious Crew" });
  assert.equal(r.deleted, true);
  for (const [table, where] of [
    ["auth.users", "id=$1"],
    ["public.households", "guardian_id=$1"],
    ["public.audit_events", "actor=$1"],
    ["public.moderation_cases", "reporter=$1"],
  ])
    assert.equal(
      await count(`select count(*) n from ${table} where ${where}`, [A]),
      0,
      table,
    );
  assert.equal(
    await count("select count(*) n from public.child_profiles where id=$1", [
      sibling,
    ]),
    0,
  );
  // Nothing orphaned: every remaining session row belongs to a surviving household.
  assert.equal(
    await count(
      "select count(*) n from public.game_sessions g where not exists(select 1 from public.households h where h.id=g.household_id)",
    ),
    0,
  );
  const ledger = await h.one<{ children: number; sessions: number }>(
    "select children,sessions from private.account_deletions order by deleted_at desc limit 1",
  );
  assert.equal(ledger.children, 1);
  assert.ok(ledger.sessions >= 2);
  // The other household is untouched.
  assert.equal(
    await count(
      "select count(*) n from public.child_profiles c join public.households h on h.id=c.household_id where h.guardian_id=$1",
      [B],
    ),
    before.bChildren,
  );
  assert.equal(
    await count("select count(*) n from public.audit_events where actor=$1", [
      B,
    ]),
    before.bAudit,
  );
  // A token for the deleted identity can no longer act.
  await assert.rejects(
    () => h.cmd(A, "household", { name: "Back again", consent: true }),
    /confirmed guardian/,
  );
});

test("a guardian without a household can still delete their identity", async () => {
  await assert.rejects(
    () => h.cmd(LONER, "account_delete", { confirm: "Curious Crew" }),
    /exactly/,
  );
  await h.cmd(LONER, "account_delete", { confirm: "DELETE" });
  assert.equal(
    await count("select count(*) n from auth.users where id=$1", [LONER]),
    0,
  );
});
