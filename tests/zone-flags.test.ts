import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "e7777777-7777-4777-8777-777777777777";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string;
const challenge = async (mode: string) =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode=$1",
      [mode],
    )
  ).id;
const setFlag = (flag: string, on: boolean) =>
  h.db.query("update private.feature_flags set enabled=$2 where flag=$1", [
    flag,
    on,
  ]);

before(async () => {
  h = await harness([[G, true]]);
  await h.cmd(G, "household", { name: "Flag Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Flick",
    age: 11,
    avatar: "owl",
    interest: "world",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
  await h.cmd(G, "permissions", { world: true, q: true, minutes: 30 });
});
after(async () => {
  await h.db.close();
});

test("every zone and Q hints are on by default; SafeZone stays off", async () => {
  const flags = (
    (await h.as(G, "select public.qz_flags() f")).rows[0] as {
      f: Record<string, boolean>;
    }
  ).f;
  for (const f of [
    "zone_quick",
    "zone_solve",
    "zone_build",
    "zone_debate",
    "zone_world",
    "q_hints",
  ])
    assert.equal(flags[f], true, f);
  assert.equal(flags.safezone, false);
});

test("a paused zone refuses new sessions while other zones keep working", async () => {
  await setFlag("zone_world", false);
  await assert.rejects(
    async () =>
      h.cmd(G, "create", {
        challenge: await challenge("world"),
        children: [kid],
      }),
    /zone is paused/,
  );
  await h.cmd(G, "create", {
    challenge: await challenge("build"),
    children: [kid],
  });
  await setFlag("zone_world", true);
  await h.cmd(G, "create", {
    challenge: await challenge("world"),
    children: [kid],
  });
});

test("pausing a zone lets sessions already in progress finish", async () => {
  // Session limit is 3 open sessions per household; cancel the earlier ones.
  await h.db.query("update public.game_sessions set state='cancelled'");
  const { session } = (await h.cmd(G, "create", {
    challenge: await challenge("quick"),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  await setFlag("zone_quick", false);
  const steps = await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const st of steps)
    await h.cmd(G, "answer", { session, step: st.id, choice: 0 });
  assert.equal(
    (
      await h.one<{ state: string }>(
        "select state from public.game_sessions where id=$1",
        [session],
      )
    ).state,
    "complete",
  );
  await setFlag("zone_quick", true);
});

test("pausing Q hints refuses hints without breaking play", async () => {
  await h.db.query(
    "update public.game_sessions set state='cancelled' where state<>'complete'",
  );
  const { session } = (await h.cmd(G, "create", {
    challenge: await challenge("debate"),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  await setFlag("q_hints", false);
  await assert.rejects(() => h.cmd(G, "hint", { session }), /hints are paused/);
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.ai_evaluations where session_id=$1",
          [session],
        )
      ).n,
    ),
    0,
  );
  await setFlag("q_hints", true);
  const r = await h.cmd(G, "hint", { session });
  assert.equal(typeof r.hint, "string");
});

test("flags are operator-only: guardians and anon cannot change or read the table", async () => {
  await assert.rejects(
    () => h.as(G, "update private.feature_flags set enabled=false"),
    /permission denied/,
  );
  await assert.rejects(
    () => h.as(G, "select * from private.feature_flags"),
    /permission denied/,
  );
  await assert.rejects(async () => {
    await h.db.exec("set role anon");
    try {
      await h.db.query("select public.qz_flags()");
    } finally {
      await h.db.exec("reset role");
    }
  }, /permission denied/);
});
