import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

const G = "aa111111-1111-4111-8111-111111111111",
  O = "aa222222-2222-4222-8222-222222222222";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string, quick: string;
const status = async (u: string) =>
  ((await h.as(u, "select public.qz_consent_status() s")).rows[0] as { s: any })
    .s;

before(async () => {
  h = await harness([
    [G, true],
    [O, true],
  ]);
  await h.cmd(G, "household", { name: "Consent Crew", consent: true });
  await h.cmd(G, "child", {
    nickname: "Kit",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  kid = (await h.one<{ id: string }>("select id from public.child_profiles"))
    .id;
  quick = (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick'",
    )
  ).id;
});
after(async () => {
  await h.db.close();
});

test("new households accept the current consent and get a record", async () => {
  const s = await status(G);
  assert.equal(s.current, 1);
  assert.equal(s.accepted, 1);
  assert.equal(s.pending, false);
  assert.equal(s.text, null);
  assert.equal(s.history.length, 1);
});

test("a new consent version blocks new sessions until the guardian accepts it", async () => {
  await h.db.query(
    "insert into public.consent_versions(version,summary,body) values(2,'Adds town hall participation','I consent to everything in version 1, and to SafeZone town hall participation when I approve it per session.')",
  );
  const s = await status(G);
  assert.equal(s.pending, true);
  assert.match(s.text.body, /SafeZone/);
  await assert.rejects(
    () => h.cmd(G, "create", { challenge: quick, children: [kid] }),
    /updated family consent/,
  );
  await assert.rejects(
    () => h.cmd(G, "consent_accept", { version: 1 }),
    /current consent version \(2\)/,
  );
  await h.cmd(G, "consent_accept", { version: 2 });
  assert.equal((await status(G)).pending, false);
  assert.deepEqual(
    (await status(G)).history.map((x: { version: number }) => x.version),
    [1, 2],
  );
  await h.cmd(G, "create", { challenge: quick, children: [kid] });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.audit_events where actor=$1 and action='consent_accept'",
          [G],
        )
      ).n,
    ),
    1,
  );
});

test("households created after a new version start on it; records are private", async () => {
  await h.cmd(O, "household", { name: "Later Crew", consent: true });
  assert.equal((await status(O)).accepted, 2);
  assert.equal(
    (await h.as(O, "select * from public.consent_records")).rows.length,
    1,
  );
  await assert.rejects(
    () => h.as(G, "update public.households set consent_version=1"),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      h.as(
        G,
        "insert into public.consent_versions(version,summary,body) values(3,'nope nope nope','not allowed from a guardian session')",
      ),
    /permission denied/,
  );
});

test("deleting the account removes its consent records", async () => {
  await h.cmd(O, "account_delete", { confirm: "Later Crew" });
  assert.equal(
    Number(
      (
        await h.one<{ n: string }>(
          "select count(*) n from public.consent_records where actor=$1",
          [O],
        )
      ).n,
    ),
    0,
  );
});
