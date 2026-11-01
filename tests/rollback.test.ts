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
const downNamed = (name: string) => down(downs.find((f) => f.includes(name))!);
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

test("stepwise rollback leaves a working schema at every stage", async () => {
  // zone flags → kill switches gone, zones still playable
  await downNamed("_zone_flags");
  assert.equal(await fn("public.qz_flags()"), false);
  // hardening → rate limiting gone, router still serves SafeZone
  await downNamed("_hardening");
  assert.equal(await exists("private.rate_events"), false);
  assert.equal(await fn("public.qz_rate(text)"), false);
  await assert.rejects(
    () => h.cmd(G, "sz_permission", { enabled: true }),
    /not open yet/,
  );
  // safezone → tables, flag, and router branch gone
  await downNamed("_safezone");
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
  // quickzone scoring → triggers removed; QuickZone still scores base points
  await downNamed("_quickzone_scoring");
  assert.equal(await fn("private.quick_bonus()"), false);
  // family controls → original router; data-rights commands no longer exist
  await downNamed("_family_controls");
  await assert.rejects(() => h.cmd(G, "export", {}), /Unknown command/);
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
