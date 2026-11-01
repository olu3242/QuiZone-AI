import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "b5555555-5555-4555-8555-555555555555",
  O = "b6666666-6666-4666-8666-666666666666";
let h: Awaited<ReturnType<typeof harness>>;
let kids: string[] = [];
const mode = async (m: string) =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode=$1",
      [m],
    )
  ).id;
async function play(user: string, m: string, players: string[]) {
  const { session } = (await h.cmd(user, "create", {
    challenge: await mode(m),
    children: players,
  })) as { session: string };
  await h.cmd(user, "transition", { session, state: "ready" });
  await h.cmd(user, "transition", { session, state: "active" });
  const steps = await h.rows<{ id: string; kind: string }>(
    "select s.id,s.kind from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const s of steps) {
    if (s.kind === "allocation")
      await h.cmd(user, "plan", {
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
      await h.cmd(user, "blueprint", {
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
    else await h.cmd(user, "answer", { session, step: s.id, choice: 0 });
  }
  return session;
}
const childBadges = async (child: string) =>
  (
    await h.rows<{ badge_code: string }>(
      "select badge_code from public.child_badges where child_id=$1 order by badge_code",
      [child],
    )
  ).map((r) => r.badge_code);
const familyBadges = async (user: string) =>
  (
    await h.rows<{ badge_code: string }>(
      "select b.badge_code from public.household_badges b join public.households h on h.id=b.household_id where h.guardian_id=$1 order by 1",
      [user],
    )
  ).map((r) => r.badge_code);

before(async () => {
  h = await harness([
    [G, true],
    [O, true],
  ]);
  await h.cmd(G, "household", { name: "Badge Crew", consent: true });
  await h.cmd(O, "household", { name: "Other Crew", consent: true });
  await h.cmd(G, "permissions", { world: true, q: false, minutes: 60 });
  for (const n of ["Ada", "Bo", "Cy"])
    await h.cmd(G, "child", {
      nickname: n,
      age: 11,
      avatar: "owl",
      interest: "science",
    });
  kids = (
    await h.rows<{ id: string }>(
      "select id from public.child_profiles order by nickname",
    )
  ).map((r) => r.id);
});
after(async () => {
  await h.db.close();
});

test("no badge without recorded completion; cancelled sessions award nothing", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await mode("quick"),
    children: [kids[0]],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "cancelled" });
  assert.deepEqual(await childBadges(kids[0]), []);
  assert.deepEqual(await familyBadges(G), []);
});

test("first completion awards child and family badges exactly once", async () => {
  await play(G, "quick", [kids[0]]);
  assert.deepEqual(await childBadges(kids[0]), [
    "first_adventure",
    "quick_spark",
  ]);
  assert.deepEqual(await familyBadges(G), ["family_first"]);
  await play(G, "quick", [kids[0]]);
  assert.equal((await childBadges(kids[0])).length, 2, "idempotent");
});

test("zone badges, passport stamp, whole crew, and all five zones", async () => {
  await play(G, "world", [kids[0]]);
  assert.ok((await childBadges(kids[0])).includes("globe_stamp"));
  await play(G, "solve", kids);
  assert.ok((await familyBadges(G)).includes("whole_crew"));
  await play(G, "build", [kids[0]]);
  await play(G, "debate", [kids[0]]);
  const all = await childBadges(kids[0]);
  for (const b of [
    "world_spark",
    "solve_spark",
    "build_spark",
    "debate_spark",
    "all_zones",
  ])
    assert.ok(all.includes(b), b);
  assert.ok(
    (await familyBadges(G)).includes("family_five"),
    "six completed game nights",
  );
  assert.deepEqual(await childBadges(kids[1]), [
    "first_adventure",
    "solve_spark",
  ]);
});

test("badges are household-private and cannot be forged", async () => {
  assert.equal(
    (await h.as(O, "select * from public.child_badges")).rows.length,
    0,
  );
  assert.equal(
    (await h.as(O, "select * from public.household_badges")).rows.length,
    0,
  );
  assert.equal(
    (await h.as(G, "select * from public.child_badges")).rows.length > 0,
    true,
  );
  await assert.rejects(
    () =>
      h.as(
        G,
        "insert into public.child_badges(child_id,badge_code) values($1,'ten_adventures')",
        [kids[2]],
      ),
    /permission denied/,
  );
  assert.equal(
    (await h.as(O, "select * from public.badges")).rows.length,
    12,
    "catalog is public to signed-in users",
  );
});

test("deleting an explorer removes their badges; sessions purge without breaking family badges", async () => {
  await h.cmd(G, "child_delete", { child: kids[2], confirm: "Cy" });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.child_badges where child_id=$1",
          [kids[2]],
        )
      ).n,
    ),
    0,
  );
  await h.cmd(G, "account_delete", { confirm: "Badge Crew" });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.household_badges",
        )
      ).n,
    ),
    0,
  );
});
