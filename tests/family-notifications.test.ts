import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./support/db";

// QZ-36: the family inbox is written only by the database, read only by the guardian.
const G = "a7111111-1111-4111-8111-111111111111",
  M = "a7222222-2222-4222-8222-222222222222",
  O = "a7333333-3333-4333-8333-333333333333",
  A = "a7444444-4444-4444-8444-444444444444";
let h: Awaited<ReturnType<typeof harness>>;
let kid: string;
type Notice = {
  id: string;
  kind: string;
  title: string;
  read_at: string | null;
};
const inbox = async (u: string) =>
  (
    await h.as(
      u,
      "select id,kind,title,read_at from public.family_notifications order by created_at",
    )
  ).rows as Notice[];
const quick = async () =>
  (
    await h.one<{ id: string }>(
      "select id from public.challenges where mode='quick' limit 1",
    )
  ).id;

before(async () => {
  h = await harness([
    [G, true],
    [M, true],
    [O, true],
    [A, true],
  ]);
  await h.db.query(
    "insert into private.staff(user_id,role) values($1,'admin')",
    [A],
  );
  await h.cmd(G, "household", { name: "Inbox Crew", consent: true });
  await h.cmd(O, "household", { name: "Other Inbox", consent: true });
  await h.cmd(G, "child", {
    nickname: "Remy",
    age: 10,
    avatar: "fox",
    interest: "science",
  });
  kid = (
    await h.one<{ id: string }>(
      "select id from public.child_profiles where nickname='Remy'",
    )
  ).id;
});
after(async () => {
  await h.db.close();
});

test("badges, member changes, and report reviews each leave one notice", async () => {
  const { session } = (await h.cmd(G, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session, state: "ready" });
  await h.cmd(G, "transition", { session, state: "active" });
  const steps = await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [session],
  );
  for (const s of steps)
    await h.cmd(G, "answer", { session, step: s.id, choice: 0 });
  let n = await inbox(G);
  assert.ok(n.some((x) => x.kind === "badge" && /Remy earned/.test(x.title)));
  assert.ok(n.some((x) => x.kind === "badge" && /^Family badge/.test(x.title)));
  const badges = n.filter((x) => x.kind === "badge").length;
  const { code } = (await h.cmd(G, "member_invite", {})) as { code: string };
  await h.cmd(M, "member_join", { code, displayName: "Nana Jo" });
  await h.cmd(G, "member_remove", { member: M });
  await h.cmd(G, "report", { session, reason: "incorrect" });
  const c = (
    await h.one<{ id: string }>("select id from public.moderation_cases")
  ).id;
  await h.cmd(A, "review", { caseId: c, status: "under_review" });
  await h.cmd(A, "review", { caseId: c, status: "dismissed" });
  n = await inbox(G);
  assert.deepEqual(
    n.filter((x) => x.kind !== "badge").map((x) => x.title),
    [
      "Nana Jo joined your family",
      "Nana Jo no longer has access",
      "A report is being reviewed",
      "A report was reviewed: no change needed",
    ],
  );
  // Replaying the same game doesn't repeat badge notices.
  const again = (await h.cmd(G, "create", {
    challenge: await quick(),
    children: [kid],
  })) as { session: string };
  await h.cmd(G, "transition", { session: again.session, state: "ready" });
  await h.cmd(G, "transition", { session: again.session, state: "active" });
  for (const s of await h.rows<{ id: string }>(
    "select s.id from public.challenge_steps s join public.game_sessions g on g.challenge_version_id=s.version_id where g.id=$1 order by s.ordinal",
    [again.session],
  ))
    await h.cmd(G, "answer", { session: again.session, step: s.id, choice: 0 });
  assert.equal(
    (await inbox(G)).filter((x) => x.kind === "badge").length,
    badges,
  );
});

test("a new consent version notifies every household that needs to accept it, once", async () => {
  await h.db.query(
    "insert into public.consent_versions(version,summary,body) values(2,'Clearer data retention terms','We explain how long gameplay records are kept and how to remove them.')",
  );
  for (const u of [G, O]) {
    const c = (await inbox(u)).filter((x) => x.kind === "consent_update");
    assert.equal(c.length, 1, u);
  }
  await h.cmd(G, "consent_accept", { version: 2 });
  await h.cmd(O, "consent_accept", { version: 2 });
});

test("only the guardian reads and clears the inbox; members, other families, and locked sessions can't", async () => {
  const { code } = (await h.cmd(G, "member_invite", {})) as { code: string };
  await h.cmd(M, "member_join", { code, displayName: "Nana Jo" });
  assert.equal((await inbox(M)).length, 0);
  assert.ok((await inbox(O)).every((x) => x.kind === "consent_update"));
  await assert.rejects(
    () => h.cmd(M, "notice_read", { all: true }),
    /Only the guardian/,
  );
  const first = (await inbox(G))[0];
  await assert.rejects(
    () => h.cmd(O, "notice_read", { id: first.id }),
    /Notice not found/,
  );
  await h.cmd(G, "notice_read", { id: first.id });
  assert.ok((await inbox(G)).find((x) => x.id === first.id)?.read_at);
  await h.cmd(G, "notice_read", { all: true });
  assert.ok((await inbox(G)).every((x) => x.read_at));
  // Clients can't write notices directly.
  await assert.rejects(
    () =>
      h.as(
        G,
        "insert into public.family_notifications(household_id,kind,title) select id,'badge','Fake' from public.households",
      ),
    /permission denied/,
  );
  // Explorer mode hides the inbox.
  await h.db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ session_id: "0b000000-0000-4000-8000-000000000001" }),
  ]);
  await h.cmd(G, "explorer_lock", {});
  assert.equal((await inbox(G)).length, 0);
  await assert.rejects(
    () => h.cmd(G, "notice_read", { all: true }),
    /Explorer mode is on/,
  );
  await h.db.query("select set_config('request.jwt.claims','{}',false)");
});

test("deleting the household removes its notices without errors from the member trigger", async () => {
  await h.cmd(G, "account_delete", { confirm: "Inbox Crew" });
  assert.equal(
    Number(
      (
        await h.one<{ n: number }>(
          "select count(*) n from public.family_notifications f join public.households h on h.id=f.household_id where h.name='Inbox Crew'",
        )
      ).n,
    ),
    0,
  );
  assert.equal(
    Number(
      (
        await h.one<{ n: number }>(
          "select count(*) n from public.household_members",
        )
      ).n,
    ),
    0,
  );
});
