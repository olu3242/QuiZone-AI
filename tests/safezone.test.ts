import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const A = "a0000000-0000-4000-8000-00000000000a", // guardian, two explorers
  B = "b0000000-0000-4000-8000-00000000000b", // guardian, one explorer
  MOD = "c0000000-0000-4000-8000-00000000000c", // moderator
  MOD2 = "d0000000-0000-4000-8000-00000000000d", // a different moderator
  ADMIN = "e0000000-0000-4000-8000-00000000000e";
let h: Awaited<ReturnType<typeof harness>>;
let kidA: string, youngA: string, kidB: string, hall: string;

async function reauth(ageSeconds = 0) {
  const ts = Math.floor(Date.now() / 1000) - ageSeconds;
  await h.db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ amr: [{ method: "password", timestamp: ts }] }),
  ]);
}
const room = async (user: string, child: string | null) =>
  (
    (
      await h.as(user, "select public.qz_safezone_room($1,$2) as r", [
        hall,
        child,
      ])
    ).rows[0] as { r: Record<string, any> }
  ).r;
const lobby = async (user: string) =>
  (
    (await h.as(user, "select public.qz_safezone_lobby() as r")).rows[0] as {
      r: Record<string, any>;
    }
  ).r;
const option = async (kind: string, agenda: number | null = null) =>
  (
    await h.one<{ id: string }>(
      `select id from public.town_hall_options where town_hall_id=$1 and kind=$2 ${agenda ? "and agenda_ordinal=" + agenda : ""} order by ordinal limit 1`,
      [hall, kind],
    )
  ).id;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hallInput = (over: Record<string, unknown> = {}) => ({
  title: "How can we make our schools safer?",
  summary:
    "A moderated discussion for young problem-solvers about feeling safe at school.",
  category: "school",
  minAge: 10,
  maxAge: 13,
  capacity: 2,
  startsAt: new Date(Date.now() + 86400000).toISOString(),
  duration: 45,
  agenda: [
    { title: "Welcome and safety rules", minutes: 5 },
    { title: "What makes students feel safe?", minutes: 10 },
    { title: "Share ideas and solutions", minutes: 15 },
  ],
  options: [
    {
      kind: "contribution",
      agenda: 2,
      text: "Knowing a trusted adult I can talk to helps me feel safe.",
    },
    {
      kind: "contribution",
      agenda: 2,
      text: "Clear rules about kindness help everyone feel included.",
    },
    {
      kind: "question",
      text: "How do schools decide what safety rules to have?",
    },
    { kind: "idea", agenda: 3, text: "Start a buddy system for new students." },
    { kind: "idea", agenda: 3, text: "Create a quiet space at lunch time." },
  ],
  ...over,
});

before(async () => {
  h = await harness([
    [A, true],
    [B, true],
    [MOD, true],
    [MOD2, true],
    [ADMIN, true],
  ]);
  await h.db.query(
    "insert into private.staff values($1,'moderator'),($2,'moderator'),($3,'admin')",
    [MOD, MOD2, ADMIN],
  );
  await h.cmd(A, "household", { name: "Crew A", consent: true });
  await h.cmd(B, "household", { name: "Crew B", consent: true });
  for (const [g, nickname, age] of [
    [A, "Nova", 11],
    [A, "Tiny", 8],
    [B, "Orbit", 12],
  ] as const)
    await h.cmd(g, "child", {
      nickname,
      age,
      avatar: "owl",
      interest: "world",
    });
  const id = async (n: string) =>
    (
      await h.one<{ id: string }>(
        "select id from public.child_profiles where nickname=$1",
        [n],
      )
    ).id;
  kidA = await id("Nova");
  youngA = await id("Tiny");
  kidB = await id("Orbit");
});
after(async () => {
  await h.db.close();
});

test("SafeZone ships disabled: guardian commands refused while moderators can prepare drafts", async () => {
  await reauth();
  await assert.rejects(
    () => h.cmd(A, "sz_permission", { enabled: true }),
    /not open yet/,
  );
  const r = await h.cmd(MOD, "sz_hall_create", hallInput());
  hall = r.hall as string;
  assert.equal((await lobby(A)).enabled, false);
  await h.db.query(
    "update private.feature_flags set enabled=true where flag='safezone'",
  );
  assert.equal((await lobby(A)).enabled, true);
});

test("only staff create and run town halls; another moderator cannot run this one; admin can", async () => {
  await assert.rejects(
    () => h.cmd(A, "sz_hall_create", hallInput()),
    /moderator role/,
  );
  await assert.rejects(
    () => h.cmd(A, "sz_hall_state", { hall, state: "scheduled" }),
    /moderator role/,
  );
  await assert.rejects(
    () => h.cmd(MOD2, "sz_hall_state", { hall, state: "scheduled" }),
    /assigned moderator/,
  );
  await assert.rejects(
    () =>
      h.cmd(
        MOD,
        "sz_hall_create",
        hallInput({
          options: [{ kind: "idea", text: "Only an idea card here." }],
        }),
      ),
    /statement card/,
  );
  await assert.rejects(
    () => h.cmd(MOD, "sz_hall_create", hallInput({ minAge: 14, maxAge: 10 })),
    /check constraint/,
  );
  await assert.rejects(
    () => h.cmd(ADMIN, "sz_hall_create", hallInput({ moderator: A })),
    /must hold a staff role/,
  );
  const other = (
    await h.cmd(ADMIN, "sz_hall_create", hallInput({ moderator: MOD2 }))
  ).hall as string;
  assert.equal(
    (
      await h.one<{ moderator_id: string }>(
        "select moderator_id from public.town_halls where id=$1",
        [other],
      )
    ).moderator_id,
    MOD2,
  );
});

test("drafts are invisible to guardians; scheduling must be in the future", async () => {
  assert.equal(
    (await h.as(A, "select * from public.town_halls where id=$1", [hall])).rows
      .length,
    0,
  );
  assert.equal((await lobby(A)).halls.length, 0);
  await assert.rejects(
    () => h.cmd(MOD, "sz_hall_state", { hall, state: "active" }),
    /transition/,
  );
  await h.db.query(
    "update public.town_halls set starts_at=now()-interval '1 hour' where id=$1",
    [hall],
  );
  await assert.rejects(
    () => h.cmd(MOD, "sz_hall_state", { hall, state: "scheduled" }),
    /future/,
  );
  await h.db.query(
    "update public.town_halls set starts_at=now()+interval '1 day' where id=$1",
    [hall],
  );
  await h.cmd(MOD, "sz_hall_state", { hall, state: "scheduled" });
  assert.equal((await lobby(A)).halls.length, 1);
});

test("registration requires permission, per-session consent, a fresh password, and age eligibility", async () => {
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: kidA, consent: true }),
    /Enable SafeZone/,
  );
  await reauth(3600);
  await assert.rejects(
    () => h.cmd(A, "sz_permission", { enabled: true }),
    /guardian password/,
  );
  await reauth();
  await h.cmd(A, "sz_permission", { enabled: true });
  await h.cmd(B, "sz_permission", { enabled: true });
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: kidA }),
    /consent is required/,
  );
  await reauth(600);
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: kidA, consent: true }),
    /guardian password/,
  );
  await reauth();
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: youngA, consent: true }),
    /ages 10 to 13/,
  );
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: kidB, consent: true }),
    /permission denied/,
  );
  const r = await h.cmd(A, "sz_register", { hall, child: kidA, consent: true });
  assert.match(r.handle as string, /^[A-Z][a-z]+ [A-Z][a-z]+ \d+$/);
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: kidA, consent: true }),
    /Already registered/,
  );
  await h.cmd(A, "child_archive", { child: youngA, archived: true });
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: youngA, consent: true }),
    /not found/,
  );
  await h.cmd(A, "child_archive", { child: youngA, archived: false });
});

test("capacity is enforced under the hall lock", async () => {
  await h.cmd(B, "sz_register", { hall, child: kidB, consent: true });
  await h.db.query("update public.child_profiles set age=12 where id=$1", [
    youngA,
  ]);
  await assert.rejects(
    () => h.cmd(A, "sz_register", { hall, child: youngA, consent: true }),
    /full/,
  );
});

test("room access is registration-gated and leaks no names or ids across households", async () => {
  await assert.rejects(() => room(A, youngA), /Register/);
  await assert.rejects(() => room(B, kidA), /Register/);
  const view = await room(B, kidB);
  const text = JSON.stringify(view);
  for (const secret of ["Nova", "Orbit", "Crew A", kidA, kidB, A, B])
    assert.equal(text.includes(secret), false, secret);
  assert.equal(view.participants, 2);
  assert.equal(view.moderator, false);
  assert.equal(view.pending, null);
  assert.equal(view.roster, null);
});

test("lifecycle: hands and cards only while active; statement cards need a granted turn", async () => {
  await assert.rejects(
    () => h.cmd(A, "sz_hand", { hall, child: kidA, raised: true }),
    /not active/,
  );
  await h.cmd(MOD, "sz_hall_state", { hall, state: "open" });
  await h.cmd(MOD, "sz_hall_state", { hall, state: "active" });
  const say = await option("contribution", 2);
  await assert.rejects(
    () => h.cmd(A, "sz_say", { hall, child: kidA, option: say }),
    /different agenda item/,
  );
  await h.cmd(MOD, "sz_agenda", { hall, item: 2 });
  await assert.rejects(
    () => h.cmd(A, "sz_say", { hall, child: kidA, option: say }),
    /speaking turn/,
  );
  await h.cmd(A, "sz_hand", { hall, child: kidA, raised: true });
  await h.cmd(A, "sz_hand", { hall, child: kidA, raised: true }); // idempotent
  await h.cmd(B, "sz_hand", { hall, child: kidB, raised: true });
  const modView = await room(MOD, null);
  assert.deepEqual(
    modView.queue.map((q: any) => q.state),
    ["waiting", "waiting"],
  );
  const kidView = await room(B, kidB);
  assert.equal(kidView.queue[0].hand, null, "hand ids are moderator-only");
  await assert.rejects(
    () => h.cmd(MOD2, "sz_turn", { hall, hand: modView.queue[0].hand }),
    /assigned moderator/,
  );
  await h.cmd(MOD, "sz_turn", { hall, hand: modView.queue[0].hand });
  assert.equal((await room(A, kidA)).me.hand, "speaking");
  await h.cmd(A, "sz_say", { hall, child: kidA, option: say });
  await assert.rejects(
    () => h.cmd(B, "sz_say", { hall, child: kidB, option: say }),
    /speaking turn/,
  );
  // Granting the next turn ends the current one: one speaker at a time.
  await h.cmd(MOD, "sz_turn", {
    hall,
    hand: (await room(MOD, null)).queue[1].hand,
  });
  assert.equal((await room(A, kidA)).me.hand, null);
  assert.equal((await room(B, kidB)).me.hand, "speaking");
});

test("contributions are held for moderator approval; questions are anonymous; rate-limited and de-duplicated", async () => {
  assert.equal(
    (await room(B, kidB)).feed.length,
    0,
    "pending is not visible to peers",
  );
  const pending = (await room(MOD, null)).pending;
  assert.equal(pending.length, 1);
  await assert.rejects(
    () => h.cmd(A, "sz_review", { contribution: pending[0].id, approve: true }),
    /moderator role/,
  );
  await h.cmd(MOD, "sz_review", { contribution: pending[0].id, approve: true });
  await assert.rejects(
    () =>
      h.cmd(MOD, "sz_review", { contribution: pending[0].id, approve: false }),
    /already reviewed/,
  );
  const q = await option("question");
  await assert.rejects(
    () => h.cmd(A, "sz_say", { hall, child: kidA, option: q }),
    /few seconds/,
  );
  await wait(5100);
  await h.cmd(A, "sz_say", { hall, child: kidA, option: q });
  await wait(5100);
  await assert.rejects(
    () => h.cmd(A, "sz_say", { hall, child: kidA, option: q }),
    /already shared/,
  );
  await h.cmd(MOD, "sz_review", {
    contribution: (await room(MOD, null)).pending[0].id,
    approve: true,
  });
  const feed = (await room(B, kidB)).feed;
  assert.equal(feed.length, 2);
  assert.match(feed[0].handle, /\d+$/);
  assert.equal(feed[1].kind, "question");
  assert.equal(feed[1].handle, null);
  const foreign = (
    await h.one<{ id: string }>(
      "select id from public.town_hall_options where town_hall_id<>$1 limit 1",
      [hall],
    )
  ).id;
  await assert.rejects(
    () => h.cmd(B, "sz_say", { hall, child: kidB, option: foreign }),
    /this town hall's cards/,
  );
});

test("polls: moderator-only drafts, one vote per explorer, results hidden until closed", async () => {
  const { poll } = (await h.cmd(MOD, "sz_poll_create", {
    hall,
    question: "Which idea should we try first?",
    options: ["Buddy system", "Quiet space"],
  })) as { poll: string };
  assert.equal((await room(A, kidA)).polls.length, 0);
  await assert.rejects(
    () => h.cmd(A, "sz_vote", { poll, child: kidA, choice: 0 }),
    /not open/,
  );
  await h.cmd(MOD, "sz_poll_state", { poll, state: "open" });
  await h.cmd(A, "sz_vote", { poll, child: kidA, choice: 0 });
  await assert.rejects(
    () => h.cmd(A, "sz_vote", { poll, child: kidA, choice: 1 }),
    /already voted/,
  );
  await assert.rejects(
    () => h.cmd(B, "sz_vote", { poll, child: kidB, choice: 7 }),
    /Invalid choice/,
  );
  await assert.rejects(
    () => h.cmd(B, "sz_vote", { poll, child: kidA, choice: 1 }),
    /permission denied/,
  );
  await h.cmd(B, "sz_vote", { poll, child: kidB, choice: 0 });
  assert.equal((await room(A, kidA)).polls[0].results, null);
  assert.equal((await room(A, kidA)).me.votes[poll], 0);
  await h.cmd(MOD, "sz_poll_state", { poll, state: "closed" });
  assert.deepEqual((await room(A, kidA)).polls[0].results, [2, 0]);
  await assert.rejects(
    () => h.cmd(A, "sz_vote", { poll, child: kidA, choice: 0 }),
    /not open|already voted/,
  );
});

test("cross-family isolation: raw SafeZone rows are household-private", async () => {
  for (const table of [
    "town_hall_registrations",
    "town_hall_votes",
    "town_hall_contributions",
    "town_hall_hands",
  ]) {
    const rows = (await h.as(B, `select * from public.${table}`))
      .rows as Record<string, string>[];
    assert.ok(!JSON.stringify(rows).includes(kidA), table);
  }
  for (const sql of [
    "insert into public.town_hall_votes(poll_id,child_id,choice) select id,$1,1 from public.town_hall_polls limit 1",
    "update public.town_hall_registrations set status='registered' where child_id=$1",
    "update public.town_hall_contributions set status='approved' where child_id=$1",
  ])
    await assert.rejects(() => h.as(B, sql, [kidB]), /permission denied/);
  await assert.rejects(
    () => h.as(B, "update private.feature_flags set enabled=false"),
    /permission denied/,
  );
});

test("moderator removal needs a reason, notifies the guardian, audits, and blocks re-entry", async () => {
  const handle = (await room(B, kidB)).me.handle as string;
  await assert.rejects(
    () => h.cmd(MOD, "sz_remove", { hall, handle }),
    /reason/,
  );
  await h.cmd(MOD, "sz_remove", {
    hall,
    handle,
    reason: "Repeated off-topic disruption",
  });
  const view = await room(B, kidB);
  assert.equal(view.me.status, "removed");
  assert.equal(view.feed, undefined, "removed explorers lose room access");
  await assert.rejects(
    () => h.cmd(B, "sz_hand", { hall, child: kidB, raised: true }),
    /registered/,
  );
  await reauth();
  await assert.rejects(
    () => h.cmd(B, "sz_register", { hall, child: kidB, consent: true }),
    /removed/,
  );
  const notes = (await lobby(B)).notifications;
  assert.ok(
    notes.some((n: any) => n.kind === "removed" && /off-topic/.test(n.message)),
  );
  const rep = await h.one<{ status: string; severity: string }>(
    "select status,severity from public.safezone_reports where reason='removal'",
  );
  assert.deepEqual(rep, { status: "actioned", severity: "high" });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.audit_events where actor=$1 and action='sz_remove'",
          [MOD],
        )
      ).n,
    ),
    1,
  );
});

test("guardian reports create an auditable case reviewed by staff, visible only to that household", async () => {
  const contribution = (await room(A, kidA)).feed[0].id;
  await h.cmd(A, "sz_report", { hall, reason: "bullying", contribution });
  await assert.rejects(
    () => h.cmd(A, "sz_report", { hall, reason: "spam" }),
    /reason/,
  );
  const id = (
    await h.one<{ id: string }>(
      "select id from public.safezone_reports where reason='bullying'",
    )
  ).id;
  assert.equal(
    (await h.as(B, "select * from public.safezone_reports where id=$1", [id]))
      .rows.length,
    0,
  );
  await assert.rejects(
    () => h.cmd(A, "sz_report_review", { report: id, status: "dismissed" }),
    /moderator role/,
  );
  await h.cmd(MOD2, "sz_report_review", {
    report: id,
    status: "under_review",
    note: "Checking context",
  });
  await h.cmd(MOD2, "sz_report_review", {
    report: id,
    status: "dismissed",
    note: "Approved card; no abuse found",
  });
  await assert.rejects(
    () => h.cmd(MOD, "sz_report_review", { report: id, status: "escalated" }),
    /already resolved/,
  );
  const events = await h.rows<{ status: string }>(
    "select status from public.safezone_report_events where report_id=$1 order by created_at",
    [id],
  );
  assert.deepEqual(
    events.map((e) => e.status),
    ["open", "under_review", "dismissed"],
  );
  assert.ok(
    (await lobby(A)).notifications.some((n: any) => n.kind === "report_update"),
  );
  assert.equal((await lobby(A)).reports[0].status, "dismissed");
  assert.equal(
    (
      await h.as(
        A,
        "select * from public.safezone_report_events where report_id=$1",
        [id],
      )
    ).rows.length,
    0,
    "moderation notes are staff-only",
  );
});

test("completion produces a privacy-safe summary with idea support counts", async () => {
  await h.cmd(MOD, "sz_agenda", { hall, item: 3 });
  await wait(5100);
  await h.cmd(A, "sz_say", {
    hall,
    child: kidA,
    option: await option("idea", 3),
  });
  await h.cmd(MOD, "sz_review", {
    contribution: (await room(MOD, null)).pending[0].id,
    approve: true,
  });
  await h.cmd(MOD, "sz_hall_state", { hall, state: "completed" });
  const s = (await room(A, kidA)).summary;
  assert.equal(s.ideas.length, 1);
  assert.equal(s.ideas[0].supporters, 1);
  assert.equal(s.contributions, 3);
  await assert.rejects(
    () => h.cmd(A, "sz_hand", { hall, child: kidA, raised: true }),
    /not active/,
  );
});

test("withdrawing consent removes the explorer's contributions and votes; disabling SafeZone withdraws everywhere", async () => {
  const second = (
    await h.cmd(MOD, "sz_hall_create", hallInput({ capacity: 5 }))
  ).hall as string;
  await h.cmd(MOD, "sz_hall_state", { hall: second, state: "scheduled" });
  await reauth();
  await h.cmd(A, "sz_register", { hall: second, child: kidA, consent: true });
  await h.cmd(A, "sz_register", { hall: second, child: youngA, consent: true });
  await h.cmd(MOD, "sz_hall_state", { hall: second, state: "open" });
  await h.cmd(MOD, "sz_hall_state", { hall: second, state: "active" });
  const q = (
    await h.one<{ id: string }>(
      "select id from public.town_hall_options where town_hall_id=$1 and kind='question'",
      [second],
    )
  ).id;
  await h.cmd(A, "sz_say", { hall: second, child: kidA, option: q });
  const { poll } = (await h.cmd(MOD, "sz_poll_create", {
    hall: second,
    question: "Pick one option now",
    options: ["A", "B"],
  })) as { poll: string };
  await h.cmd(MOD, "sz_poll_state", { poll, state: "open" });
  await h.cmd(A, "sz_vote", { poll, child: kidA, choice: 1 });
  await h.cmd(A, "sz_withdraw", { hall: second, child: kidA });
  const counts = await h.one<{ v: number; c: number }>(
    "select (select count(*) from public.town_hall_votes where child_id=$1 and poll_id=$2) v, (select count(*) from public.town_hall_contributions where child_id=$1 and town_hall_id=$3 and status<>'withdrawn') c",
    [kidA, poll, second],
  );
  assert.deepEqual(
    { v: Number(counts.v), c: Number(counts.c) },
    { v: 0, c: 0 },
  );
  await h.cmd(A, "sz_permission", { enabled: false });
  const reg = await h.one<{ status: string }>(
    "select status from public.town_hall_registrations where town_hall_id=$1 and child_id=$2",
    [second, youngA],
  );
  assert.equal(reg.status, "withdrawn");
});

test("emergency closure cancels the hall, escalates an urgent incident, and notifies every household", async () => {
  const third = (await h.cmd(MOD, "sz_hall_create", hallInput({ capacity: 5 })))
    .hall as string;
  await h.cmd(MOD, "sz_hall_state", { hall: third, state: "scheduled" });
  await reauth();
  await h.cmd(A, "sz_permission", { enabled: true });
  await h.cmd(A, "sz_register", { hall: third, child: kidA, consent: true });
  await h.cmd(MOD, "sz_hall_state", { hall: third, state: "open" });
  await h.cmd(MOD, "sz_hall_state", { hall: third, state: "active" });
  await assert.rejects(
    () => h.cmd(MOD, "sz_emergency_close", { hall: third }),
    /reason/,
  );
  await h.cmd(MOD, "sz_emergency_close", {
    hall: third,
    reason: "Safeguarding concern raised",
  });
  const t = await h.one<{ state: string; closed_reason: string }>(
    "select state,closed_reason from public.town_halls where id=$1",
    [third],
  );
  assert.equal(t.state, "cancelled");
  assert.match(t.closed_reason, /^emergency:/);
  const rep = await h.one<{ severity: string; status: string }>(
    "select severity,status from public.safezone_reports where town_hall_id=$1 and reason='emergency'",
    [third],
  );
  assert.deepEqual(rep, { severity: "urgent", status: "escalated" });
  assert.ok(
    (await lobby(A)).notifications.some((n: any) => n.kind === "closed"),
  );
  await assert.rejects(
    () => h.cmd(A, "sz_hand", { hall: third, child: kidA, raised: true }),
    /not active/,
  );
});

test("account deletion cascades through SafeZone rows without orphans", async () => {
  await h.cmd(B, "account_delete", { confirm: "Crew B" });
  for (const table of [
    "town_hall_registrations",
    "town_hall_votes",
    "town_hall_contributions",
    "town_hall_hands",
  ])
    assert.equal(
      Number(
        (
          await h.one<{ n: string }>(
            `select count(*) n from public.${table} where child_id=$1`,
            [kidB],
          )
        ).n,
      ),
      0,
      table,
    );
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.safezone_reports where reporter=$1",
          [B],
        )
      ).n,
    ),
    0,
  );
});
