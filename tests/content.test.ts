import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "c1111111-1111-4111-8111-111111111111",
  ADMIN = "c2222222-2222-4222-8222-222222222222",
  MOD = "c3333333-3333-4333-8333-333333333333";
let h: Awaited<ReturnType<typeof harness>>;
const challenge = async (mode: string) =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode=$1 order by title limit 1",
      [mode],
    )
  ).id;

before(async () => {
  h = await harness([
    [G, true],
    [ADMIN, true],
    [MOD, true],
  ]);
  await h.db.query(
    "insert into private.staff values($1,'admin'),($2,'moderator')",
    [ADMIN, MOD],
  );
  await h.cmd(G, "household", { name: "Content Crew", consent: true });
});
after(async () => {
  await h.db.close();
});

test("QZ-21: seeded challenges carry subject and difficulty", async () => {
  const rows = await h.rows<{
    mode: string;
    subject: string;
    difficulty: string;
  }>("select mode,subject,difficulty from public.challenges order by mode");
  assert.deepEqual(
    Object.fromEntries(
      rows.map((r) => [r.mode, `${r.subject}/${r.difficulty}`]),
    ),
    {
      build: "creativity/explorer",
      debate: "civics/challenger",
      quick: "science/starter",
      solve: "environment/explorer",
      world: "world/explorer",
    },
  );
});

test("QZ-21: only admins edit metadata; values are constrained and audited", async () => {
  const id = await challenge("quick");
  await assert.rejects(
    () =>
      h.cmd(G, "cms_meta", {
        challenge: id,
        subject: "math",
        difficulty: "challenger",
      }),
    /administrator/,
  );
  await assert.rejects(
    () =>
      h.cmd(MOD, "cms_meta", {
        challenge: id,
        subject: "math",
        difficulty: "challenger",
      }),
    /administrator/,
  );
  await assert.rejects(
    () =>
      h.cmd(ADMIN, "cms_meta", {
        challenge: id,
        subject: "astrology",
        difficulty: "starter",
      }),
    /check constraint/,
  );
  await h.cmd(ADMIN, "cms_meta", {
    challenge: id,
    subject: "math",
    difficulty: "challenger",
  });
  const r = await h.one<{ subject: string; difficulty: string }>(
    "select subject,difficulty from public.challenges where id=$1",
    [id],
  );
  assert.deepEqual(r, { subject: "math", difficulty: "challenger" });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.audit_events where actor=$1 and action='cms_meta'",
          [ADMIN],
        )
      ).n,
    ),
    1,
  );
  await h.cmd(ADMIN, "cms_meta", {
    challenge: id,
    subject: "science",
    difficulty: "starter",
  });
});

const step = (over: Record<string, unknown> = {}) => ({
  prompt: "Which planet has the most moons?",
  options: ["Saturn", "Mars", "Venus"],
  correct: 0,
  hint: "Think about the ringed giant.",
  explanation: "Saturn has the most confirmed moons.",
  ...over,
});
const versions = async (cid: string) =>
  h.rows<{ id: string; version: number; status: string }>(
    "select id,version,status from public.challenge_versions where challenge_id=$1 order by version",
    [cid],
  );
const cms = async (vid: string) =>
  (
    (await h.as(ADMIN, "select public.qz_cms_version($1) r", [vid]))
      .rows[0] as { r: any }
  ).r;
let quick: string, v2: string, oldSession: string;

test("QZ-22: a new version copies the published content into a single open draft", async () => {
  quick = await challenge("quick");
  const kid =
    (await h.cmd(G, "child", {
      nickname: "Vers",
      age: 10,
      avatar: "fox",
      interest: "science",
    }),
    (
      await h.one<{ id: string }>(
        "select id from public.child_profiles where nickname='Vers'",
      )
    ).id);
  oldSession = (
    (await h.cmd(G, "create", { challenge: quick, children: [kid] })) as {
      session: string;
    }
  ).session;
  await assert.rejects(
    () => h.cmd(G, "cms_version_new", { challenge: quick }),
    /administrator/,
  );
  v2 = (
    (await h.cmd(ADMIN, "cms_version_new", { challenge: quick })) as {
      version: string;
    }
  ).version;
  await assert.rejects(
    () => h.cmd(ADMIN, "cms_version_new", { challenge: quick }),
    /open draft/,
  );
  const view = await cms(v2);
  assert.equal(view.status, "draft");
  assert.equal(view.steps.length, 3);
  assert.equal(
    typeof view.steps[0].correct,
    "number",
    "admin view includes answer keys",
  );
  await assert.rejects(
    () => h.as(G, "select public.qz_cms_version($1)", [v2]),
    /administrator/,
  );
});

test("QZ-22: drafts are editable step by step; published steps are not", async () => {
  const added = (
    (await h.cmd(ADMIN, "cms_step_add", { version: v2, ...step() })) as {
      step: string;
    }
  ).step;
  await h.cmd(ADMIN, "cms_step_update", {
    step: added,
    ...step({ correct: 1, options: ["Mars", "Saturn"] }),
  });
  let view = await cms(v2);
  assert.equal(view.steps.length, 4);
  assert.equal(view.steps[3].correct, 1);
  await h.cmd(ADMIN, "cms_step_delete", { step: view.steps[0].id });
  view = await cms(v2);
  assert.deepEqual(
    view.steps.map((s: { ordinal: number }) => s.ordinal),
    [1, 2, 3],
    "ordinals renumbered; the delete really happened",
  );
  await assert.rejects(
    () =>
      h.cmd(ADMIN, "cms_step_add", {
        version: v2,
        ...step({ options: ["Only one"] }),
      }),
    /Invalid step/,
  );
  const published = (await versions(quick)).find(
    (v) => v.status === "published",
  )!;
  const pubStep = (
    await h.one<{ id: string }>(
      "select id from public.challenge_steps where version_id=$1 limit 1",
      [published.id],
    )
  ).id;
  await assert.rejects(
    () => h.cmd(ADMIN, "cms_step_update", { step: pubStep, ...step() }),
    /Only draft versions/,
  );
  await h.cmd(ADMIN, "cms_version_update", {
    version: v2,
    scenario:
      "A refreshed set of quick science questions for curious families.",
    minAge: 9,
    maxAge: 14,
  });
  assert.equal(
    (await cms(v2)).ageReviewed,
    false,
    "editing resets the age review",
  );
});

test("QZ-22: publishing a new version retires the old one; past sessions keep their content", async () => {
  await h.cmd(ADMIN, "publish", { version: v2, ageReviewed: true });
  const vs = await versions(quick);
  assert.deepEqual(
    vs.map((v) => v.status),
    ["retired", "published"],
  );
  const old = await h.one<{ challenge_version_id: string }>(
    "select challenge_version_id from public.game_sessions where id=$1",
    [oldSession],
  );
  assert.equal(
    old.challenge_version_id,
    vs[0].id,
    "the existing session still points at v1",
  );
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.challenge_steps where version_id=$1",
          [vs[0].id],
        )
      ).n,
    ),
    3,
    "v1 steps intact",
  );
  await h.db.query("update public.game_sessions set state='cancelled'");
  const kid = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Vers'",
    )
  ).id;
  const fresh = (
    (await h.cmd(G, "create", { challenge: quick, children: [kid] })) as {
      session: string;
    }
  ).session;
  assert.equal(
    (
      await h.one<{ challenge_version_id: string }>(
        "select challenge_version_id from public.game_sessions where id=$1",
        [fresh],
      )
    ).challenge_version_id,
    v2,
  );
});

test("QZ-22: immutability still holds except published → retired", async () => {
  await assert.rejects(
    () =>
      h.db.query(
        "update public.challenge_versions set scenario='Tampered scenario text here' where id=$1",
        [v2],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      h.db.query(
        "update public.challenge_versions set status='retired', scenario='Tampered while retiring' where id=$1",
        [v2],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      h.db.query(
        "update public.challenge_versions set status='draft' where id=$1",
        [v2],
      ),
    /immutable/,
  );
  await h.cmd(ADMIN, "cms_version_retire", { version: v2 });
  await assert.rejects(
    () => h.cmd(ADMIN, "cms_version_retire", { version: v2 }),
    /Only a published/,
  );
  const kid = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Vers'",
    )
  ).id;
  await h.db.query("update public.game_sessions set state='cancelled'");
  await assert.rejects(
    () => h.cmd(G, "create", { challenge: quick, children: [kid] }),
    /unavailable/,
  );
});

test("QZ-22: non-choice steps (allocation/blueprint) are copied but not editable in the CMS", async () => {
  const solve = await challenge("solve");
  const vid = (
    (await h.cmd(ADMIN, "cms_version_new", { challenge: solve })) as {
      version: string;
    }
  ).version;
  const view = await cms(vid);
  const alloc = view.steps.find(
    (s: { kind: string }) => s.kind === "allocation",
  );
  assert.ok(alloc);
  await assert.rejects(
    () => h.cmd(ADMIN, "cms_step_update", { step: alloc.id, ...step() }),
    /edited in code/,
  );
});

test("QZ-22: quality findings are reported for drafts", async () => {
  const build = await challenge("build");
  const vid = (
    (await h.cmd(ADMIN, "cms_version_new", { challenge: build })) as {
      version: string;
    }
  ).version;
  await h.cmd(ADMIN, "cms_step_add", {
    version: vid,
    ...step({
      options: ["Same", "same "],
      hint: "Saturn has the most confirmed moons.",
    }),
  });
  const issues: string[] = (await cms(vid)).issues;
  assert.ok(issues.some((i) => /duplicate options/.test(i)));
  assert.ok(issues.some((i) => /gives the answer away/.test(i)));
});

test("QZ-22: literal-message quality checks report instead of erroring (WorldZone country)", async () => {
  await h.cmd(ADMIN, "draft", {
    mode: "world",
    title: "Rivers of the world",
    scenario: "Explore how rivers shape the cities that grow beside them.",
    prompt: "Which river flows through Cairo?",
    options: ["The Nile", "The Thames"],
    correct: 0,
    hint: "It is one of the longest rivers on Earth.",
    explanation: "The Nile flows through Cairo, Egypt.",
  });
  const vid = (
    await h.one<{ id: string }>(
      "select v.id from public.challenge_versions v join public.challenges c on c.id=v.challenge_id where c.title='Rivers of the world'",
    )
  ).id;
  const issues: string[] = (await cms(vid)).issues;
  assert.ok(
    issues.includes("WorldZone challenges need a country"),
    JSON.stringify(issues),
  );
});

test("QZ-23: publishing is refused while quality issues remain, then allowed once fixed", async () => {
  const build = await challenge("build");
  const draft = (await versions(build)).find((v) => v.status === "draft")!;
  await assert.rejects(
    () => h.cmd(ADMIN, "publish", { version: draft.id, ageReviewed: true }),
    /Quality check failed: .*duplicate options/,
  );
  // A direct status update (bypassing the command) hits the same gate.
  await assert.rejects(
    () =>
      h.db.query(
        "update public.challenge_versions set status='published' where id=$1",
        [draft.id],
      ),
    /Quality check failed/,
  );
  const bad = (await cms(draft.id)).steps.find((s: { options: string[] }) =>
    s.options.includes("Same"),
  );
  await h.cmd(ADMIN, "cms_step_update", { step: bad.id, ...step() });
  assert.deepEqual((await cms(draft.id)).issues, []);
  await h.cmd(ADMIN, "publish", { version: draft.id, ageReviewed: true });
  assert.deepEqual(
    (await versions(build)).map((v) => v.status),
    ["retired", "published"],
  );
});

test("QZ-38: admins set a WorldZone country so CMS-authored WorldZone challenges can publish", async () => {
  const { harness } = await import("./support/db");
  const A = "a9111111-1111-4111-8111-111111111111",
    G = "a9222222-2222-4222-8222-222222222222";
  const h = await harness([
    [A, true],
    [G, true],
  ]);
  try {
    await h.db.query(
      "insert into private.staff(user_id,role) values($1,'admin')",
      [A],
    );
    await h.cmd(A, "draft", {
      title: "Rivers of the world",
      mode: "world",
      scenario: "Explore how a great river shapes the towns along its banks.",
      prompt: "What does a river give the towns along it?",
      options: ["Water and travel", "Nothing at all"],
      correct: 0,
      hint: "Think about boats and drinking water.",
      explanation: "Rivers carry water, food, and people.",
    });
    const c = await h.one<{ id: string; v: string }>(
      "select c.id, v.id v from public.challenges c join public.challenge_versions v on v.challenge_id=c.id where c.title='Rivers of the world'",
    );
    await assert.rejects(
      () => h.cmd(A, "publish", { version: c.v, ageReviewed: true }),
      /need a country/,
    );
    await assert.rejects(
      () => h.cmd(G, "cms_country", { challenge: c.id, country: "Egypt" }),
      /administrator/,
    );
    await assert.rejects(
      () => h.cmd(A, "cms_country", { challenge: c.id, country: "<b>x</b>" }),
      /country name/,
    );
    await h.cmd(A, "cms_country", { challenge: c.id, country: "Egypt" });
    await h.cmd(A, "publish", { version: c.v, ageReviewed: true });
    const quick = (
      await h.one<{ id: string }>(
        "select id from public.challenges where mode='quick' limit 1",
      )
    ).id;
    await assert.rejects(
      () => h.cmd(A, "cms_country", { challenge: quick, country: "Egypt" }),
      /WorldZone challenge not found/,
    );
  } finally {
    await h.db.close();
  }
});
