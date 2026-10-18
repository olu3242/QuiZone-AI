import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  STAFF = "33333333-3333-4333-8333-333333333333",
  UNCONFIRMED = "44444444-4444-4444-8444-444444444444";
async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user || "",
  ]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function cmd(user: string | null, action: string, data: unknown) {
  const r = await as(user, "select public.qz_command($1,$2::jsonb) as result", [
    action,
    JSON.stringify(data),
  ]);
  return (r.rows[0] as { result: Record<string, string> }).result;
}
async function rows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  return (await db.query<T>(sql, params)).rows;
}
let householdA: string, childA: string, childB: string, quick: string;
before(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.query(
    "insert into auth.users values($1,now()),($2,now()),($3,now()),($4,null)",
    [A, B, STAFF, UNCONFIRMED],
  );
  const migration = readdirSync("supabase/migrations").find((s) =>
    s.endsWith("_quizone_pilot.sql"),
  )!;
  await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  await db.query("insert into private.staff values($1,'admin')", [STAFF]);
});
after(async () => {
  await db.close();
});
test("unauthenticated and unconfirmed accounts cannot mutate", async () => {
  await assert.rejects(
    () => cmd(null, "household", { name: "Bad", consent: true }),
    /confirmed guardian/,
  );
  await assert.rejects(
    () => cmd(UNCONFIRMED, "household", { name: "Bad", consent: true }),
    /confirmed guardian/,
  );
});
test("household creation persists consent and default-deny permissions", async () => {
  await cmd(A, "household", { name: "Curious Crew", consent: true });
  await cmd(B, "household", { name: "Another Crew", consent: true });
  const h = await rows<{ id: string }>(
    "select id from public.households where guardian_id=$1",
    [A],
  );
  householdA = h[0].id;
  const p = await rows(
    "select * from public.guardian_permissions where household_id=$1",
    [householdA],
  );
  assert.equal(p[0].world, false);
  assert.equal(p[0].q, false);
  await assert.rejects(
    () => cmd(A, "household", { name: "Again", consent: true }),
    /already exists/,
  );
});
test("guardian consent cannot be bypassed through raw RPC payloads", async () => {
  await assert.rejects(() =>
    cmd(STAFF, "household", { name: "Missing consent" }),
  );
});
test("child profiles validate age and belong to the guardian household", async () => {
  await cmd(A, "child", {
    nickname: "Cosmic Fox",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  await cmd(B, "child", {
    nickname: "Panda",
    age: 12,
    avatar: "panda",
    interest: "nature",
  });
  childA = (
    await rows<{ id: string }>(
      "select id from public.child_profiles where household_id=$1",
      [householdA],
    )
  )[0].id;
  childB = (
    await rows<{ id: string }>(
      "select id from public.child_profiles where household_id<>$1",
      [householdA],
    )
  )[0].id;
  await assert.rejects(
    () =>
      cmd(A, "child", {
        nickname: "Too young",
        age: 3,
        avatar: "fox",
        interest: "science",
      }),
    /check constraint/,
  );
});
test("RLS hides another household and its children", async () => {
  const r = await as(A, "select * from public.child_profiles");
  assert.equal(r.rows.length, 1);
  assert.equal((r.rows[0] as { id: string }).id, childA);
  const h = await as(B, "select * from public.households where id=$1", [
    householdA,
  ]);
  assert.equal(h.rows.length, 0);
});
test("client cannot directly forge score, session, or child rows", async () => {
  await assert.rejects(
    () =>
      as(A, "update public.child_profiles set household_id=$1", [householdA]),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      as(
        A,
        "insert into public.score_events(session_id,child_id,points,skill) values(gen_random_uuid(),$1,999999,'fake')",
        [childA],
      ),
    /permission denied/,
  );
  await assert.rejects(
    () => as(A, "select * from private.answer_keys"),
    /permission denied/,
  );
});
test("five reviewed challenges and eighteen steps seed successfully", async () => {
  assert.equal((await rows("select * from public.challenges")).length, 5);
  assert.equal((await rows("select * from public.challenge_steps")).length, 18);
  quick = (
    await rows<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  )[0].id;
});
test("WorldZone requires explicit permission", async () => {
  const w = (
    await rows<{ id: string }>(
      "select id from public.challenges where mode='world'",
    )
  )[0].id;
  await assert.rejects(
    () => cmd(A, "create", { challenge: w, children: [childA] }),
    /enable WorldZone/,
  );
});
test("cross-household, empty, and missing player lists cannot create games", async () => {
  await assert.rejects(
    () => cmd(A, "create", { challenge: quick, children: [childB] }),
    /not eligible/,
  );
  await assert.rejects(
    () => cmd(A, "create", { challenge: quick, children: [] }),
    /players/,
  );
  await assert.rejects(() => cmd(A, "create", { challenge: quick }));
});
test("published challenge versions and steps are immutable", async () => {
  const v = await rows<{ id: string }>(
    "select id from public.challenge_versions limit 1",
  );
  await assert.rejects(
    () =>
      db.query(
        "update public.challenge_versions set scenario='Changed' where id=$1",
        [v[0].id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      db.query(
        "update public.challenge_steps set prompt='Changed' where version_id=$1",
        [v[0].id],
      ),
    /immutable/,
  );
});
test("complete quick journey persists exact-once scores, feedback, and audit trail", async () => {
  const { session } = await cmd(A, "create", {
    challenge: quick,
    children: [childA],
  });
  await assert.rejects(
    () => cmd(B, "transition", { session, state: "ready" }),
    /permission denied/,
  );
  await assert.rejects(
    () => cmd(A, "transition", { session, state: "active" }),
    /transition/,
  );
  await cmd(A, "transition", { session, state: "ready" });
  await cmd(A, "transition", { session, state: "active" });
  const steps = await rows<{ id: string; kind: string; correct: number }>(
    "select s.id,s.kind,k.correct from public.challenge_steps s join private.answer_keys k on k.step_id=s.id join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  await assert.rejects(
    () =>
      cmd(A, "answer", {
        session,
        step: steps[1].id,
        choice: steps[1].correct,
      }),
    /current step/,
  );
  await assert.rejects(() => cmd(A, "hint", { session }), /unavailable/);
  await cmd(A, "permissions", { world: true, q: true, minutes: 30 });
  const hint = await cmd(A, "hint", { session });
  assert.equal(typeof hint.hint, "string");
  await cmd(A, "transition", { session, state: "paused" });
  await assert.rejects(
    () =>
      cmd(A, "answer", {
        session,
        step: steps[0].id,
        choice: steps[0].correct,
      }),
    /resume/,
  );
  await cmd(A, "transition", { session, state: "active" });
  for (const s of steps)
    await cmd(A, "answer", { session, step: s.id, choice: s.correct });
  const game = (
    await rows<{ state: string; total_score: number }>(
      "select state,total_score from public.game_sessions where id=$1",
      [session],
    )
  )[0];
  assert.equal(game.state, "complete");
  assert.equal(game.total_score, 300);
  await assert.rejects(
    () =>
      cmd(A, "answer", {
        session,
        step: steps[2].id,
        choice: steps[2].correct,
      }),
    /resume/,
  );
  const scores = await rows(
    "select * from public.score_events where session_id=$1",
    [session],
  );
  assert.equal(scores.length, 1);
  assert.equal(scores[0].points, 300);
  assert.ok(
    (
      await rows("select * from public.audit_events where household_id=$1", [
        householdA,
      ])
    ).length >= 8,
  );
  assert.equal(
    (
      await as(B, "select * from public.player_answers where session_id=$1", [
        session,
      ])
    ).rows.length,
    0,
  );
});
test("wrong choices earn participation only; replay cannot inflate score", async () => {
  const { session } = await cmd(A, "create", {
    challenge: quick,
    children: [childA],
  });
  await cmd(A, "transition", { session, state: "ready" });
  await cmd(A, "transition", { session, state: "active" });
  const s = (
    await rows<{ id: string; kind: string; correct: number }>(
      "select s.id,s.kind,k.correct from public.challenge_steps s join private.answer_keys k on k.step_id=s.id join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
      [session],
    )
  )[0];
  await cmd(A, "answer", { session, step: s.id, choice: (s.correct + 1) % 3 });
  await assert.rejects(
    () => cmd(A, "answer", { session, step: s.id, choice: s.correct }),
    /current step/,
  );
  assert.equal(
    (
      await rows("select total_score from public.game_sessions where id=$1", [
        session,
      ])
    )[0].total_score,
    25,
  );
  await cmd(A, "transition", { session, state: "cancelled" });
  assert.equal(
    (
      await rows("select * from public.score_events where session_id=$1", [
        session,
      ])
    ).length,
    0,
  );
});
test("all five modes complete and WorldZone awards a household-only stamp", async () => {
  const challenges = await rows<{ id: string; mode: string }>(
    "select id,mode from public.challenges",
  );
  for (const c of challenges) {
    const { session } = await cmd(A, "create", {
      challenge: c.id,
      children: [childA],
    });
    await cmd(A, "transition", { session, state: "ready" });
    await cmd(A, "transition", { session, state: "active" });
    const steps = await rows<{ id: string; kind: string; correct: number }>(
      "select s.id,s.kind,k.correct from public.challenge_steps s join private.answer_keys k on k.step_id=s.id join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
      [session],
    );
    for (const s of steps)
      if (s.kind === "allocation")
        await cmd(A, "plan", {
          session,
          step: s.id,
          allocation: {
            solar: 35000,
            wind: 30000,
            battery: 20000,
            diesel: 0,
            grid: 0,
            efficiency: 10000,
          },
        });
      else if (s.kind === "blueprint")
        await cmd(A, "blueprint", {
          session,
          step: s.id,
          design: {
            roof: true,
            access: true,
            seating: true,
            lighting: false,
            mural: false,
          },
        });
      else await cmd(A, "answer", { session, step: s.id, choice: s.correct });
    assert.equal(
      (
        await rows("select state from public.game_sessions where id=$1", [
          session,
        ])
      )[0].state,
      "complete",
    );
  }
  const stamps = await as(A, "select * from public.passport_entries");
  assert.equal(stamps.rows.length, 1);
  assert.equal((stamps.rows[0] as { country: string }).country, "Singapore");
  assert.equal(
    (await as(B, "select * from public.passport_entries")).rows.length,
    0,
  );
});
test("expired session rejects advancement without score changes", async () => {
  const { session } = await cmd(A, "create", {
    challenge: quick,
    children: [childA],
  });
  await db.query(
    "update public.game_sessions set expires_at=now()-interval '1 minute' where id=$1",
    [session],
  );
  const out = await cmd(A, "transition", { session, state: "ready" });
  assert.equal(out.expired, true);
  assert.equal(
    (
      await rows("select state from public.game_sessions where id=$1", [
        session,
      ])
    )[0].state,
    "expired",
  );
});
test("reports are durable, idempotent, scoped, and reviewed with audit history", async () => {
  const s = (
    await rows<{ id: string }>(
      "select id from public.game_sessions where household_id=$1 limit 1",
      [householdA],
    )
  )[0].id;
  await cmd(A, "report", { session: s, reason: "incorrect" });
  await cmd(A, "report", { session: s, reason: "incorrect" });
  const cases = await rows<{ id: string }>(
    "select id from public.moderation_cases where session_id=$1",
    [s],
  );
  assert.equal(cases.length, 1);
  assert.equal(
    (await as(B, "select * from public.moderation_cases")).rows.length,
    0,
  );
  await assert.rejects(
    () => cmd(A, "review", { caseId: cases[0].id, status: "actioned" }),
    /Permission denied/,
  );
  await cmd(STAFF, "review", { caseId: cases[0].id, status: "under_review" });
  await cmd(STAFF, "review", { caseId: cases[0].id, status: "dismissed" });
  assert.equal(
    (
      await rows("select status from public.moderation_cases where id=$1", [
        cases[0].id,
      ])
    )[0].status,
    "dismissed",
  );
  assert.equal(
    (
      await rows(
        "select * from public.audit_events where action='review' and reference_id=$1",
        [cases[0].id],
      )
    ).length,
    2,
  );
});
test("CMS draft is not playable until staff content review", async () => {
  const payload = {
    title: "An honest draft",
    mode: "quick",
    scenario: "A new reviewed family learning scenario.",
    prompt: "Which choice is the best option?",
    options: ["First option", "Second option"],
    correct: 0,
    hint: "Consider the evidence in the scenario.",
    explanation: "The first option follows the stated evidence.",
  };
  await assert.rejects(() => cmd(A, "draft", payload), /Permission denied/);
  await cmd(STAFF, "draft", payload);
  const c = (
    await rows<{ id: string }>(
      "select id from public.challenges where title='An honest draft'",
    )
  )[0].id;
  await assert.rejects(
    () => cmd(A, "create", { challenge: c, children: [childA] }),
    /unavailable/,
  );
  const v = (
    await rows<{ id: string }>(
      "select id from public.challenge_versions where challenge_id=$1",
      [c],
    )
  )[0].id;
  await assert.rejects(
    () => cmd(STAFF, "publish", { version: v }),
    /Age review/,
  );
  await cmd(STAFF, "publish", { version: v, ageReviewed: true });
  const { session } = await cmd(A, "create", {
    challenge: c,
    children: [childA],
  });
  assert.ok(session);
  await cmd(A, "transition", { session, state: "cancelled" });
});
test("game-night scheduling validates date and persists within the household", async () => {
  await assert.rejects(
    () => cmd(A, "schedule", { at: "2020-01-01T00:00:00Z", mode: "quick" }),
    /next year/,
  );
  await cmd(A, "schedule", {
    at: new Date(Date.now() + 86400000).toISOString(),
    mode: "quick",
  });
  assert.equal(
    (await as(A, "select * from public.game_nights")).rows.length,
    1,
  );
  assert.equal(
    (await as(B, "select * from public.game_nights")).rows.length,
    0,
  );
});
test("every user-data table has RLS enabled; anon has no command access", async () => {
  const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
    "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname in ('public','private') and c.relkind='r'",
  );
  assert.ok(tables.every((t) => t.relrowsecurity));
  await db.exec("set role anon");
  try {
    await assert.rejects(
      () => db.query("select public.qz_command('household','{}')"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("island budget validation is server-authoritative and keeps rejected plans out of history", async () => {
  const c = (
    await rows<{ id: string }>(
      "select id from public.challenges where mode='solve'",
    )
  )[0].id;
  const { session } = await cmd(A, "create", {
    challenge: c,
    children: [childA],
  });
  await cmd(A, "transition", { session, state: "ready" });
  await cmd(A, "transition", { session, state: "active" });
  const step = (
    await rows<{ id: string }>(
      "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 and s.ordinal=1",
      [session],
    )
  )[0].id;
  await assert.rejects(
    () =>
      cmd(A, "plan", {
        session,
        step,
        allocation: {
          solar: 100000,
          wind: 30000,
          battery: 20000,
          diesel: 0,
          grid: 0,
          efficiency: 0,
        },
      }),
    /100,000/,
  );
  await assert.rejects(
    () =>
      cmd(A, "plan", {
        session,
        step,
        allocation: {
          solar: -1,
          wind: 0,
          battery: 0,
          diesel: 0,
          grid: 0,
          efficiency: 0,
        },
      }),
    /whole dollars/,
  );
  await assert.rejects(
    () => cmd(A, "plan", { session, step, allocation: { solar: 1000 } }),
    /six/,
  );
  assert.equal(
    (
      await rows("select * from public.player_answers where session_id=$1", [
        session,
      ])
    ).length,
    0,
  );
  await cmd(A, "plan", {
    session,
    step,
    allocation: {
      solar: 35000,
      wind: 30000,
      battery: 20000,
      diesel: 0,
      grid: 0,
      efficiency: 10000,
    },
  });
  const a = (
    await rows<{ allocation: { solar: number }; points: number }>(
      "select allocation,points from public.player_answers where session_id=$1",
      [session],
    )
  )[0];
  assert.equal(a.allocation.solar, 35000);
  assert.equal(a.points, 100);
  await cmd(A, "transition", { session, state: "cancelled" });
});
test("BuildZone persists a costed design and rejects overspending", async () => {
  const c = (
    await rows<{ id: string }>(
      "select id from public.challenges where mode='build'",
    )
  )[0].id;
  const { session } = await cmd(A, "create", {
    challenge: c,
    children: [childA],
  });
  await cmd(A, "transition", { session, state: "ready" });
  await cmd(A, "transition", { session, state: "active" });
  const step = (
    await rows<{ id: string }>(
      "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 and s.ordinal=1",
      [session],
    )
  )[0].id;
  await assert.rejects(
    () =>
      cmd(A, "blueprint", {
        session,
        step,
        design: {
          roof: true,
          access: true,
          seating: true,
          lighting: true,
          mural: true,
        },
      }),
    /10,000/,
  );
  await cmd(A, "blueprint", {
    session,
    step,
    design: {
      roof: true,
      access: true,
      seating: true,
      lighting: false,
      mural: false,
    },
  });
  const plan = (
    await rows<{ total_cost: number }>(
      "select total_cost from public.build_submissions where session_id=$1",
      [session],
    )
  )[0];
  assert.equal(plan.total_cost, 8500);
  assert.equal(
    (
      await as(
        B,
        "select * from public.build_submissions where session_id=$1",
        [session],
      )
    ).rows.length,
    0,
  );
  await cmd(A, "transition", { session, state: "cancelled" });
});
test("raw RPC rejects null payloads, missing permissions, and invalid staff drafts", async () => {
  await assert.rejects(() => cmd(A, "permissions", {}), /permissions/);
  await assert.rejects(
    () =>
      cmd(A, "child", {
        nickname: "Fox",
        age: 10,
        avatar: "public-photo",
        interest: "science",
      }),
    /check constraint/,
  );
  await assert.rejects(
    () => cmd(STAFF, "draft", { title: "Incomplete" }),
    /content/,
  );
  await assert.rejects(() => cmd(A, "create", null), /payload/);
});
test("guardian cannot impersonate staff or write audit history directly", async () => {
  assert.equal(
    (await as(A, "select public.qz_is_staff('admin') as allowed")).rows[0] &&
      (
        (await as(A, "select public.qz_is_staff('admin') as allowed"))
          .rows[0] as { allowed: boolean }
      ).allowed,
    false,
  );
  await assert.rejects(
    () => as(A, "insert into private.staff values($1,'admin')", [A]),
    /permission denied/,
  );
  await assert.rejects(
    () => as(A, "delete from public.audit_events where actor=$1", [A]),
    /permission denied/,
  );
});
