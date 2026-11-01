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
