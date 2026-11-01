import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-32: Explorer mode is bound to the Auth session in the JWT, not to client state.
const G = "f1111111-1111-4111-8111-111111111111",
  M = "f2222222-2222-4222-8222-222222222222";
const S1 = "0a000000-0000-4000-8000-000000000001", // the shared screen's session
  S2 = "0a000000-0000-4000-8000-000000000002"; // after re-entering the password
let h: Awaited<ReturnType<typeof harness>>;
let kid: string;
const onSession = (sid: string | null) =>
  h.db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify(sid ? { session_id: sid } : {}),
  ]);
const locked = async (u: string) =>
  ((await h.as(u, "select public.qz_locked() r")).rows[0] as { r: boolean }).r;
const quick = async () =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick' limit 1",
    )
  ).id;

before(async () => {
  h = await harness([
    [G, true],
    [M, true],
  ]);
  await h.cmd(G, "household", { name: "Lock Crew", consent: true });
  await h.cmd(G, "permissions", { world: false, q: true, minutes: 60 });
  await h.cmd(G, "child", {
    nickname: "Kit",
    age: 10,
    avatar: "panda",
    interest: "science",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
});
after(async () => {
  await h.db.close();
});

test("locking needs a household and a real session id", async () => {
  await onSession(null);
  await assert.rejects(() => h.cmd(G, "explorer_lock", {}), /Sign in again/);
  await onSession(S1);
  await assert.rejects(
    () => h.cmd(M, "explorer_lock", {}),
    /Create a household first/,
  );
  assert.equal(await locked(G), false);
  await h.cmd(G, "explorer_lock", {});
  assert.equal(await locked(G), true);
  // Idempotent, and audited for the guardian.
  await h.cmd(G, "explorer_lock", {});
  await onSession(S2);
  assert.ok(
    (
      await h.as(
        G,
        "select id from public.audit_events where action='explorer_lock'",
      )
    ).rows.length >= 1,
  );
  // The lock belongs to the guardian's session; another user's claim can't reuse it.
  await onSession(S1);
  assert.equal(await locked(M), false);
});

test("a locked session can play: create, transition, hint, answer, report, presence", async () => {
  await onSession(S1);
  const { session } = (await h.cmd(G, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "presence", { session });
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  await h.cmd(G, "hint", { session });
  const step = await h.one<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by ordinal limit 1",
    [session],
  );
  await h.cmd(G, "answer", { session, step: step.id, choice: 1 });
  await h.cmd(G, "report", { session, reason: "incorrect" });
  const practice = await h.cmd(G, "create", {
    challenge: await quick(),
    children: [kid],
    practice: true,
  });
  assert.ok(practice.session);
});

test("a locked session is refused every guardian action", async () => {
  await onSession(S1);
  const refused: [string, unknown][] = [
    ["child", { nickname: "Newt", age: 9, avatar: "fox", interest: "nature" }],
    ["permissions", { world: true, q: true, minutes: 120 }],
    [
      "schedule",
      { at: new Date(Date.now() + 86400000).toISOString(), mode: "quick" },
    ],
    ["child_update", { child: kid, nickname: "Kitty" }],
    ["child_archive", { child: kid, archived: true }],
    ["child_delete", { child: kid, confirm: "Kit" }],
    ["export", {}],
    ["account_delete", { confirm: "Lock Crew" }],
    ["q_budget", { limit: 50 }],
    ["consent_accept", { version: 1 }],
    ["member_invite", {}],
    ["sz_permission", { enabled: false }],
    ["cms_meta", {}],
    ["draft", {}],
  ];
  for (const [c, p] of refused)
    await assert.rejects(() => h.cmd(G, c, p), /Explorer mode is on/, c);
  assert.equal(
    Number(
      (
        await h.one<{ n: number }>(
          "select count(*) n from auth.users where id=$1",
          [G],
        )
      ).n,
    ),
    1,
  );
});

test("a locked session can't read guardian oversight data; play data stays visible", async () => {
  await onSession(S1);
  for (const [t, col] of [
    ["public.audit_events", "id"],
    ["public.moderation_cases", "id"],
    ["public.consent_records", "household_id"],
    ["public.household_invites", "id"],
  ])
    assert.equal((await h.as(G, `select ${col} from ${t}`)).rows.length, 0, t);
  assert.equal(
    (await h.as(G, "select id from public.child_profiles")).rows.length,
    1,
  );
  assert.ok(
    (await h.as(G, "select id from public.game_sessions")).rows.length >= 1,
  );
});

test("re-entering the password (a new session) is unlocked; the old session stays locked", async () => {
  await onSession(S2);
  assert.equal(await locked(G), false);
  assert.ok(
    (await h.as(G, "select id from public.moderation_cases")).rows.length >= 1,
  );
  await h.cmd(G, "child_update", {
    child: kid,
    nickname: "Kitty",
    age: 10,
    avatar: "panda",
    interest: "science",
  });
  await onSession(S1);
  assert.equal(await locked(G), true);
  await assert.rejects(
    () => h.cmd(G, "child_update", { child: kid, nickname: "Kat" }),
    /Explorer mode is on/,
  );
});

test("a family member can lock their own device", async () => {
  await onSession(S2);
  const { code } = (await h.cmd(G, "member_invite", {})) as { code: string };
  await h.cmd(M, "member_join", { code, displayName: "Uncle Jo" });
  const S3 = "0a000000-0000-4000-8000-000000000003";
  await onSession(S3);
  await h.cmd(M, "explorer_lock", {});
  assert.equal(await locked(M), true);
  await assert.rejects(
    () => h.cmd(M, "member_leave", {}),
    /Explorer mode is on/,
  );
  // The guardian's other session is unaffected.
  await onSession(S2);
  assert.equal(await locked(G), false);
});
