import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-31: guardian-invited adult family members on their own devices.
const G = "e1111111-1111-4111-8111-111111111111", // guardian
  M = "e2222222-2222-4222-8222-222222222222", // member
  O = "e3333333-3333-4333-8333-333333333333", // other household's guardian
  X = "e4444444-4444-4444-8444-444444444444", // confirmed adult, no household
  U = "e5555555-5555-4555-8555-555555555555"; // unconfirmed
let h: Awaited<ReturnType<typeof harness>>;
let kid: string, otherKid: string;
const n = async (sql: string, p: unknown[] = []) =>
  Number((await h.one<{ n: string }>(sql, p)).n);
const quick = async () =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick' limit 1",
    )
  ).id;
const invite = async () =>
  (await h.cmd(G, "member_invite", {})) as {
    id: string;
    code: string;
    expiresAt: string;
  };

before(async () => {
  h = await harness([
    [G, true],
    [M, true],
    [O, true],
    [X, true],
    [U, false],
  ]);
  await h.cmd(G, "household", { name: "Member Crew", consent: true });
  await h.cmd(O, "household", { name: "Other Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Pip",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  await h.cmd(O, "child", {
    nickname: "Zed",
    age: 10,
    avatar: "owl",
    interest: "science",
  });
  kid = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Pip'",
    )
  ).id;
  otherKid = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Zed'",
    )
  ).id;
});
after(async () => {
  await h.db.close();
});

test("an invite is single-use, shown once, and only its hash is stored", async () => {
  const inv = await invite();
  assert.match(inv.code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  const stored = await h.one<{ code_hash: string }>(
    "select code_hash from public.household_invites where id=$1",
    [inv.id],
  );
  assert.notEqual(stored.code_hash, inv.code);
  assert.ok(!stored.code_hash.includes(inv.code.replace(/-/g, "")));
  // Guardians can list invites but never read the hash column.
  await assert.rejects(
    () => h.as(G, "select code_hash from public.household_invites"),
    /permission denied/,
  );
  assert.equal(
    (await h.as(G, "select id from public.household_invites")).rows.length,
    1,
  );
  assert.equal(
    (await h.as(O, "select id from public.household_invites")).rows.length,
    0,
  );
  // Codes are case- and dash-insensitive.
  await h.cmd(M, "member_join", {
    code: inv.code.toLowerCase().replace(/-/g, " "),
    displayName: "Aunt Bea",
  });
  assert.deepEqual(
    await h.cmd(X, "member_join", { code: inv.code, displayName: "Sam" }),
    { joined: false },
  );
  const me = (await h.as(M, "select public.qz_household() r")).rows[0] as {
    r: { role: string; name: string; displayName: string };
  };
  assert.equal(me.r.role, "member");
  assert.equal(me.r.name, "Member Crew");
  assert.equal(me.r.displayName, "Aunt Bea");
  const g = (await h.as(G, "select public.qz_household() r")).rows[0] as {
    r: { role: string };
  };
  assert.equal(g.r.role, "guardian");
});

test("joining is refused for guardians, existing members, unconfirmed users, and expired or revoked codes", async () => {
  const a = await invite();
  await assert.rejects(
    () => h.cmd(O, "member_join", { code: a.code, displayName: "Olly" }),
    /already has its own household/,
  );
  await assert.rejects(
    () => h.cmd(M, "member_join", { code: a.code, displayName: "Bea" }),
    /already belong/,
  );
  await assert.rejects(
    () => h.cmd(U, "member_join", { code: a.code, displayName: "Unc" }),
    /confirmed account/,
  );
  await assert.rejects(
    () => h.cmd(X, "member_join", { code: a.code, displayName: "x@y.com" }),
    /display name/,
  );
  await h.cmd(G, "member_uninvite", { invite: a.id });
  assert.deepEqual(
    await h.cmd(X, "member_join", { code: a.code, displayName: "Sam" }),
    { joined: false },
  );
  const b = await invite();
  await h.db.query(
    "update public.household_invites set expires_at=now()-interval '1 minute' where id=$1",
    [b.id],
  );
  assert.deepEqual(
    await h.cmd(X, "member_join", { code: b.code, displayName: "Sam" }),
    { joined: false },
  );
  // A member can't create a household of their own (command and trigger).
  await assert.rejects(
    () => h.cmd(M, "household", { name: "Bea House", consent: true }),
    /already/,
  );
});

test("only the guardian issues invites; the outstanding-invite cap holds", async () => {
  await assert.rejects(
    () => h.cmd(M, "member_invite", {}),
    /Only the guardian/,
  );
  await assert.rejects(
    () => h.cmd(X, "member_invite", {}),
    /Only the guardian/,
  );
  await h.db.query(
    "update public.household_invites set revoked_at=now() where used_at is null",
  );
  for (let i = 0; i < 3; i++) await invite();
  await assert.rejects(() => invite(), /Revoke an unused invite/);
  await h.db.query(
    "update public.household_invites set revoked_at=now() where used_at is null",
  );
});

test("a member plays on their own device: create, practice, answer, hint", async () => {
  await h.cmd(G, "permissions", { world: false, q: true, minutes: 60 });
  const { session } = (await h.cmd(M, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(M, "transition", { session, state: "ready" });
  await h.cmd(M, "transition", { session, state: "active" });
  const hint = await h.cmd(M, "hint", { session });
  assert.ok(hint.hint);
  const step = await h.one<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by ordinal limit 1",
    [session],
  );
  // The guardian answers on the shared screen; the member's device sees it.
  await h.cmd(G, "answer", { session, step: step.id, choice: 0 });
  assert.equal(
    (
      await h.as(
        M,
        "select id from public.player_answers where session_id=$1",
        [session],
      )
    ).rows.length,
    1,
  );
  const practice = (await h.cmd(M, "create", {
    challenge: await quick(),
    children: [kid],
    practice: true,
  })) as { session: string };
  assert.equal(
    (
      await h.one<{ practice: boolean }>(
        "select practice from public.game_sessions where id=$1",
        [practice.session],
      )
    ).practice,
    true,
  );
  // Actions are attributable to the member in the guardian's audit trail.
  assert.ok(
    (await n(
      "select count(*) n from public.audit_events where actor=$1 and action='create'",
      [M],
    )) >= 2,
  );
  // Members read play data, never the guardian-only trail.
  assert.equal(
    (await h.as(M, "select id from public.child_profiles")).rows.length,
    1,
  );
  assert.equal(
    (await h.as(M, "select id from public.audit_events")).rows.length,
    0,
  );
  assert.equal(
    (await h.as(M, "select household_id from public.consent_records")).rows
      .length,
    0,
  );
  const usage = (await h.as(M, "select public.qz_q_usage() r")).rows[0] as {
    r: { used: number };
  };
  assert.equal(Number(usage.r.used), 1);
});

test("members are refused every guardian-only command", async () => {
  const cases: [string, unknown][] = [
    ["child", { nickname: "Newt", age: 9, avatar: "fox", interest: "nature" }],
    ["permissions", { world: true, q: true, minutes: 30 }],
    ["child_update", { child: kid, nickname: "Pippa" }],
    ["child_delete", { child: kid, confirm: "Pip" }],
    ["export", {}],
    ["q_budget", { limit: 50 }],
    ["consent_accept", { version: 1 }],
    ["sz_permission", { enabled: true }],
    ["member_remove", { member: M }],
  ];
  for (const [c, p] of cases)
    await assert.rejects(
      () => h.cmd(M, c, p),
      /guardian|household first|not open yet/i,
      c,
    );
  assert.equal(
    await n(
      "select count(*) n from public.child_profiles where nickname='Pip'",
    ),
    1,
  );
});

test("households stay isolated: members can't reach another household", async () => {
  await assert.rejects(
    async () =>
      h.cmd(M, "create", { challenge: await quick(), children: [otherKid] }),
    /not eligible/,
  );
  const { session } = (await h.cmd(O, "create", {
    challenge: await quick(),
    children: [otherKid],
  })) as { session: string };
  await assert.rejects(
    () => h.cmd(M, "transition", { session, state: "ready" }),
    /permission denied/,
  );
  await assert.rejects(
    () => h.cmd(M, "presence", { session }),
    /permission denied/,
  );
  assert.equal(
    (
      await h.as(M, "select id from public.game_sessions where id=$1", [
        session,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (await h.as(O, "select user_id from public.household_members")).rows.length,
    0,
  );
  assert.equal(
    (await h.as(X, "select id from public.households")).rows.length,
    0,
  );
});

test("presence lists the adults who have a game open, by label only", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "presence", { session });
  const r = (await h.cmd(M, "presence", { session })) as {
    devices: { label: string; you: boolean }[];
  };
  assert.deepEqual(
    r.devices.map((d) => [d.label, d.you]),
    [
      ["Aunt Bea", true],
      ["Guardian", false],
    ],
  );
  assert.ok(!JSON.stringify(r).includes(G));
  // Stale devices drop out of the lobby list.
  await h.db.query(
    "update public.session_devices set last_seen=now()-interval '1 minute' where user_id=$1",
    [G],
  );
  const later = (await h.cmd(M, "presence", { session })) as {
    devices: unknown[];
  };
  assert.equal(later.devices.length, 1);
  // Not directly readable by anyone.
  await assert.rejects(
    () => h.as(G, "select * from public.session_devices"),
    /permission denied/,
  );
});

test("the guardian removes a member; a member can leave; access ends immediately", async () => {
  await h.cmd(G, "member_remove", { member: M });
  assert.equal(
    (await h.as(M, "select id from public.child_profiles")).rows.length,
    0,
  );
  assert.equal(
    ((await h.as(M, "select public.qz_household() r")).rows[0] as { r: null })
      .r,
    null,
  );
  await assert.rejects(
    async () =>
      h.cmd(M, "create", { challenge: await quick(), children: [kid] }),
    /Create a household first/,
  );
  const inv = await invite();
  await h.cmd(X, "member_join", { code: inv.code, displayName: "Sam" });
  await h.cmd(X, "member_leave", {});
  assert.equal(await n("select count(*) n from public.household_members"), 0);
});

test("member account deletion and guardian deletion cascade cleanly", async () => {
  const inv = await invite();
  await h.cmd(M, "member_join", { code: inv.code, displayName: "Aunt Bea" });
  await h.db.query("update public.game_sessions set state='cancelled'");
  const { session } = (await h.cmd(M, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(M, "report", { session, reason: "technical" });
  await h.cmd(M, "account_delete", { confirm: "DELETE" });
  assert.equal(
    await n("select count(*) n from auth.users where id=$1", [M]),
    0,
  );
  assert.equal(await n("select count(*) n from public.household_members"), 0);
  // The household and its games are untouched by a member leaving.
  assert.equal(
    await n("select count(*) n from public.game_sessions where id=$1", [
      session,
    ]),
    1,
  );
  const again = await invite();
  await h.cmd(X, "member_join", { code: again.code, displayName: "Sam" });
  await h.cmd(G, "account_delete", { confirm: "Member Crew" });
  for (const t of [
    "public.household_members",
    "public.household_invites",
    "public.session_devices",
  ])
    assert.equal(await n(`select count(*) n from ${t}`), 0, t);
  assert.equal(
    await n("select count(*) n from auth.users where id=$1", [X]),
    1,
  );
});

test("wrong codes are metered: guessing stops at the hourly limit", async () => {
  const Y = "e6666666-6666-4666-8666-666666666666";
  await h.db.query("insert into auth.users values($1,now())", [Y]);
  for (let i = 0; i < 10; i++)
    assert.deepEqual(
      await h.cmd(Y, "member_join", {
        code: `0000-0000-000${i}`,
        displayName: "Guess",
      }),
      { joined: false },
    );
  await assert.rejects(
    () =>
      h.cmd(Y, "member_join", { code: "0000-0000-0010", displayName: "Guess" }),
    /Too many attempts/,
  );
});
