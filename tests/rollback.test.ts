import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { harness } from "./support/db";

const G = "a9999999-9999-4999-8999-999999999999";
let h: Awaited<ReturnType<typeof harness>>;
const ups = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();
const downs = readdirSync("supabase/rollback")
  .filter((f) => f.endsWith(".down.sql"))
  .sort()
  .reverse();
const exists = async (rel: string) =>
  (await h.one<{ r: string | null }>("select to_regclass($1)::text r", [rel]))
    .r !== null;
const fn = async (sig: string) =>
  (
    await h.one<{ r: string | null }>("select to_regprocedure($1)::text r", [
      sig,
    ])
  ).r !== null;
const down = (file: string) =>
  h.db.exec(readFileSync("supabase/rollback/" + file, "utf8"));
const up = (file: string) =>
  h.db.exec(readFileSync("supabase/migrations/" + file, "utf8"));

before(async () => {
  h = await harness([[G, true]]);
  await h.cmd(G, "household", { name: "Rollback Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Undo",
    age: 10,
    avatar: "owl",
    interest: "science",
  });
});
after(async () => {
  await h.db.close();
});

test("every post-pilot migration has a matching down script", () => {
  const post = ups.slice(1).map((f) => f.replace(".sql", ".down.sql"));
  assert.deepEqual([...post].sort(), [...downs].sort());
});

// Checks that must hold right after each named migration is rolled back.
const afterDown: Record<string, () => Promise<void>> = {
  _q_budget: async () => assert.equal(await fn("public.qz_q_usage()"), false),
  _ops_overview: async () =>
    assert.equal(await fn("public.qz_ops_overview()"), false),
  _consent_versions: async () =>
    assert.equal(await exists("public.consent_records"), false),
  _practice: async () =>
    assert.equal(await fn("private.mark_practice(uuid)"), false),
  _badges: async () => assert.equal(await exists("public.child_badges"), false),
  _quality_gate: async () =>
    assert.equal(await fn("private.quality_gate()"), false),
  _cms_authoring: async () =>
    assert.equal(await fn("public.qz_cms_version(uuid)"), false),
  _content_meta: async () => {
    assert.equal(await fn("private.cms_command(text,jsonb)"), false);
    await assert.rejects(
      () => h.cmd(G, "cms_meta", {}),
      /Unknown command|administrator/,
    );
  },
  _zone_flags: async () => assert.equal(await fn("public.qz_flags()"), false),
  _hardening: async () => {
    assert.equal(await exists("private.rate_events"), false);
    assert.equal(await fn("public.qz_rate(text)"), false);
    await assert.rejects(
      () => h.cmd(G, "sz_permission", { enabled: true }),
      /not open yet/,
    );
  },
  _safezone: async () => {
    for (const t of [
      "public.town_halls",
      "public.town_hall_votes",
      "private.feature_flags",
    ])
      assert.equal(await exists(t), false, t);
    await assert.rejects(
      () => h.cmd(G, "sz_permission", { enabled: true }),
      /Unknown command/,
    );
  },
  _quickzone_scoring: async () =>
    assert.equal(await fn("private.quick_bonus()"), false),
  _family_controls: async () => {
    await assert.rejects(() => h.cmd(G, "export", {}), /Unknown command/);
  },
};

test("stepwise rollback (newest first) leaves a working schema at every stage", async () => {
  for (const f of downs) {
    await down(f);
    const key = Object.keys(afterDown).find((k) => f.includes(k));
    if (key) await afterDown[key]();
  }
  // The pilot itself still works, with the data created before rollback intact.
  await h.cmd(G, "child", {
    nickname: "Pilot",
    age: 11,
    avatar: "fox",
    interest: "nature",
  });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.child_profiles",
        )
      ).n,
    ),
    2,
  );
});

test("every down script has a stage check", () => {
  for (const f of downs)
    assert.ok(
      Object.keys(afterDown).some((k) => f.includes(k)) ||
        f.includes("_family_controls"),
      `add an afterDown check for ${f}`,
    );
});

test("roll forward re-applies cleanly and every feature works again", async () => {
  for (const f of ups.slice(1)) await up(f);
  const child = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Undo'",
    )
  ).id;
  await h.cmd(G, "child_archive", { child, archived: true });
  await h.cmd(G, "export", {});
  await assert.rejects(
    () => h.cmd(G, "sz_permission", { enabled: true }),
    /not open yet/,
  );
  await h.as(G, "select public.qz_rate('export')");
  assert.equal(await fn("private.quick_bonus()"), true);
  assert.equal(await fn("public.qz_flags()"), true);
});

test("a second full down/up cycle is repeatable", async () => {
  for (const f of downs) await down(f);
  for (const f of ups.slice(1)) await up(f);
  assert.equal(await exists("public.town_halls"), true);
  assert.equal(await exists("private.rate_events"), true);
});
