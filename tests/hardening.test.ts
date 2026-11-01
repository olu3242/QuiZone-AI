import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "f1111111-1111-4111-8111-111111111111",
  OTHER = "f2222222-2222-4222-8222-222222222222",
  ADMIN = "f3333333-3333-4333-8333-333333333333";
let h: Awaited<ReturnType<typeof harness>>;
const rate = (user: string | null, bucket: string) =>
  h.as(user, "select public.qz_rate($1)", [bucket]);

before(async () => {
  h = await harness([
    [G, true],
    [OTHER, true],
    [ADMIN, true],
  ]);
  await h.db.query("insert into private.staff values($1,'admin')", [ADMIN]);
  await h.cmd(G, "household", { name: "Limit Crew", consent: true });
  await h.cmd(OTHER, "household", { name: "Other Crew", consent: true });
});
after(async () => {
  await h.db.close();
});

test("re-authentication budget: 10 per 15 minutes per guardian, isolated per user", async () => {
  for (let i = 0; i < 10; i++) await rate(G, "reauth");
  await assert.rejects(
    () => rate(G, "reauth"),
    (e: { code?: string; message: string }) => {
      assert.equal(e.code, "QZ429");
      assert.match(e.message, /Too many attempts/);
      return true;
    },
  );
  await rate(OTHER, "reauth"); // another guardian's budget is untouched
  // The window slides: aged events are pruned and the budget returns.
  await h.db.query(
    "update private.rate_events set at=now()-interval '16 minutes' where uid=$1",
    [G],
  );
  await rate(G, "reauth");
});

test("export budget is separate from re-authentication", async () => {
  for (let i = 0; i < 5; i++) await rate(OTHER, "export");
  await assert.rejects(() => rate(OTHER, "export"), /Too many attempts/);
  await rate(OTHER, "reauth");
});

test("callers cannot pick limits, reset budgets, or read the ledger", async () => {
  await assert.rejects(() => rate(G, "anything"), /Unknown rate bucket/);
  await assert.rejects(
    () => h.as(G, "select private.rate_limit('reauth', 100000, 0)"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(G, "select * from private.rate_events"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(G, "delete from private.rate_events"),
    /permission denied/,
  );
  await assert.rejects(() => rate(null, "reauth"), /sign in/);
});

test("the command router meters completed writes per user (300 per minute)", async () => {
  await h.db.query(
    "insert into private.rate_events(uid,bucket,at) select $1,'command',now() from generate_series(1,299)",
    [G],
  );
  await h.cmd(G, "export", {}); // 300th
  await assert.rejects(() => h.cmd(G, "export", {}), /Too many attempts/);
  await h.cmd(OTHER, "export", {});
  // A rejected command rolls back its own hit, so failures do not burn budget.
  const before = Number(
    (
      await h.one<{ n: string }>(
        "select count(*) n from private.rate_events where uid=$1 and bucket='command'",
        [OTHER],
      )
    ).n,
  );
  await assert.rejects(() => h.cmd(OTHER, "child_update", { child: G }));
  const afterFail = Number(
    (
      await h.one<{ n: string }>(
        "select count(*) n from private.rate_events where uid=$1 and bucket='command'",
        [OTHER],
      )
    ).n,
  );
  assert.equal(afterFail, before);
  await h.db.query("delete from private.rate_events where uid=$1", [G]);
});

test("guardians no longer see draft challenge titles; published content and admins unaffected", async () => {
  await h.cmd(ADMIN, "draft", {
    mode: "quick",
    title: "Secret upcoming quiz",
    scenario: "A draft scenario that families must not see yet.",
    prompt: "Which planet is closest to the sun?",
    options: ["Mercury", "Venus"],
    correct: 0,
    hint: "It is also the smallest planet.",
    explanation: "Mercury orbits closest to the sun.",
  });
  const guardian = (await h.as(G, "select title from public.challenges"))
    .rows as { title: string }[];
  assert.equal(guardian.length, 5);
  assert.equal(
    guardian.some((r) => r.title === "Secret upcoming quiz"),
    false,
  );
  const admin = (await h.as(ADMIN, "select title from public.challenges"))
    .rows as { title: string }[];
  assert.ok(admin.some((r) => r.title === "Secret upcoming quiz"));
});

test("router still dispatches every command family after the rewrite", async () => {
  await h.cmd(G, "child", {
    nickname: "Router",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  const id = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Router'",
    )
  ).id;
  await h.cmd(G, "child_archive", { child: id, archived: true });
  await assert.rejects(
    () => h.cmd(G, "sz_permission", { enabled: true }),
    /not open yet/,
  );
  await assert.rejects(() => h.cmd(G, "nonsense", {}), /Unknown command/);
});
