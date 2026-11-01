// QZ-30: browser certification for QZ-21..29 on a real app + Supabase stack.
// Authors its own challenge (seeded content is untouched for other suites) and
// cleans up the consent version it publishes, pass or fail.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Browser, Page } from "playwright";
import {
  BASE,
  api,
  axe,
  createHousehold,
  operatorSql,
  signupAndConfirm,
} from "./support";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const AXE = process.env.E2E_AXE_PATH || require.resolve("axe-core/axe.min.js");
const run = Date.now().toString(36);
const G = {
  email: `platform-${run}@example.test`,
  password: "Platform-Guardian-42!",
};
const ADM = {
  email: `platform-admin-${run}@example.test`,
  password: "Platform-Admin-42!",
};
const TITLE = `Ocean quiz ${run}`;
let browser: Browser, g: Page, adm: Page;
const a11y: Record<string, unknown> = {};
const errors: string[] = [];

async function start(page: Page, title: string, practice = false) {
  await page.goto(`${BASE}/challenges`);
  await page
    .locator(".challenge-grid > div", { hasText: title })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  if (practice)
    await page
      .locator("dialog")
      .getByText(/Practice round: play for fun/)
      .click();
  await page.getByRole("button", { name: /Create game night/ }).click();
  await page.waitForURL(/\/play\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: /Our crew is ready/ }).click();
  await page.getByRole("button", { name: /Start the adventure/ }).click();
  return page.url().split("/play/")[1];
}
async function answerAll(page: Page) {
  for (let i = 0; i < 12; i++) {
    if (await page.getByText("That’s a family win.").isVisible()) return;
    const before = await page.locator("h2").first().textContent();
    await page.locator(".answer-options label").first().click();
    await page.getByRole("button", { name: /Lock in our answer/ }).click();
    await page.waitForFunction(
      (p) =>
        document.querySelector("h2")?.textContent !== p ||
        document.body.textContent?.includes("That’s a family win."),
      before,
    );
  }
  await page.getByText("That’s a family win.").waitFor();
}
async function adminSaved(text = "Saved with an audit record.") {
  await adm.getByText(text).waitFor();
}
async function scan(page: Page, key: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      )
    )
      a11y[`${key}@${width}:overflow`] = true;
    const v = await axe(page, AXE);
    if (v.length) a11y[`${key}@${width}`] = v;
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}
const card = () => adm.locator(".summary-card", { hasText: TITLE });

before(async () => {
  browser = await chromium.launch();
  [g, adm] = await Promise.all(
    [1, 2].map(async () => (await browser.newContext()).newPage()),
  );
  for (const p of [g, adm])
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  adm.on("dialog", (d) => void d.accept());
  await signupAndConfirm(g, G);
  await createHousehold(g, `Platform Crew ${run}`, [["Marlin", 11]]);
  await signupAndConfirm(adm, ADM);
  operatorSql(
    `insert into private.staff select id,'admin' from auth.users where email='${ADM.email}'`,
  );
});
after(async () => {
  operatorSql(
    "update private.feature_flags set enabled=false where flag='q_live'",
  );
  // Never leave a newer consent version behind: later suites would be gated.
  operatorSql(
    "update public.households set consent_version=1 where consent_version>1; delete from public.consent_records where version>1; delete from public.consent_versions where version>1",
  );
  await browser?.close();
});

test("QZ-22/23: admin drafts a challenge; publish is refused until quality checks pass", async () => {
  await adm.goto(`${BASE}/admin`);
  await adm.locator('input[name="title"]').fill(TITLE);
  await adm.locator('select[name="mode"]').selectOption("quick");
  await adm
    .locator('textarea[name="scenario"]')
    .fill(
      "Dive into the ocean together and talk about the creatures you discover.",
    );
  await adm
    .locator('textarea[name="prompt"]')
    .first()
    .fill("Which ocean animal is a mammal?");
  await adm.locator('textarea[name="options"]').first().fill("Dolphin\nShark");
  await adm.locator('input[name="correct"]').first().fill("0");
  await adm
    .locator('textarea[name="hint"]')
    .first()
    .fill("It breathes air at the surface.");
  await adm
    .locator('textarea[name="explanation"]')
    .first()
    .fill("Dolphins are mammals; sharks are fish.");
  await adm.getByRole("button", { name: "Save draft" }).click();
  await adminSaved();
  await card()
    .getByRole("button", { name: /Edit draft v1/ })
    .click();
  const add = card().locator("details.cms-step", { hasText: "Add a step" });
  await add.locator("summary").click();
  await add
    .locator('textarea[name="prompt"]')
    .fill("Which of these lives in the deep sea?");
  await add.locator('textarea[name="options"]').fill("Anglerfish\nanglerfish");
  await add.locator('input[name="correct"]').fill("0");
  await add.locator('textarea[name="hint"]').fill("It carries its own light.");
  await add
    .locator('textarea[name="explanation"]')
    .fill("Anglerfish live in the deep sea and use a glowing lure.");
  await add.getByRole("button", { name: "Add step" }).click();
  await card().getByText("Step 2 has duplicate options").waitFor();
  await card()
    .getByRole("button", { name: /Confirm age review & publish/ })
    .click();
  await adm
    .getByText(/Quality check failed: Step 2 has duplicate options/)
    .waitFor();
  const s2 = card().locator("details.cms-step", { hasText: "Step 2:" });
  await s2.locator("summary").click();
  await s2.locator('textarea[name="options"]').fill("Anglerfish\nGoldfish");
  await s2.getByRole("button", { name: "Save step" }).click();
  await card()
    .getByText(/Quality checks pass/)
    .waitFor();
  await scan(adm, "admin-cms-editor");
  // QZ-34: Q authoring suggestions are off by default, admin-only, and need a server key.
  const step = operatorSql(
    `select s.id from public.challenge_steps s join public.challenge_versions v on v.id=s.version_id join public.challenges c on c.id=v.challenge_id where c.title='${TITLE}' order by s.ordinal limit 1`,
  );
  const suggest = () =>
    api(adm, "/api/q/suggest", { method: "POST", body: { step } });
  assert.equal(
    await s2.getByRole("button", { name: /Suggest a hint with Q/ }).count(),
    0,
  );
  assert.equal((await suggest()).status, 404);
  operatorSql(
    "update private.feature_flags set enabled=true where flag='q_live'",
  );
  try {
    await adm.evaluate(() => window.dispatchEvent(new Event("focus")));
    await s2.getByRole("button", { name: /Suggest a hint with Q/ }).click();
    await s2.getByText(/aren’t configured on this server/).waitFor();
    assert.equal((await suggest()).status, 503);
    const guardianTry = await api(g, "/api/q/suggest", {
      method: "POST",
      body: { step },
    });
    assert.equal(guardianTry.status, 403);
    await scan(adm, "admin-cms-q");
  } finally {
    operatorSql(
      "update private.feature_flags set enabled=false where flag='q_live'",
    );
  }
  await adm.evaluate(() => window.dispatchEvent(new Event("focus")));
  await card()
    .getByRole("button", { name: /Confirm age review & publish/ })
    .click();
  await card().getByText("v1 · published").waitFor();
});

test("QZ-21: admin sets subject/difficulty; families filter by them", async () => {
  await card().locator('select[name="subject"]').selectOption("math");
  await card().locator('select[name="difficulty"]').selectOption("challenger");
  await card().getByRole("button", { name: "Save details" }).click();
  await adminSaved();
  await g.goto(`${BASE}/challenges`);
  await g.getByLabel("Subject").selectOption("math");
  const titles = await g.locator(".challenge-grid h3").allTextContents();
  assert.deepEqual(titles, [TITLE]);
  await g
    .locator(".challenge-grid > div", { hasText: TITLE })
    .getByText("Math · Challenger")
    .waitFor();
  await g.getByLabel("Subject").selectOption("all");
  await g.getByLabel("Difficulty").selectOption("starter");
  assert.deepEqual(await g.locator(".challenge-grid h3").allTextContents(), [
    "Curiosity kick-off",
  ]);
  await scan(g, "challenge-filters");
});

test("QZ-22: a new version supersedes the old one; families play the newest", async () => {
  await adm.goto(`${BASE}/admin`);
  await card().getByRole("button", { name: "New version" }).click();
  await adminSaved();
  await card()
    .getByRole("button", { name: /Edit draft v2/ })
    .click();
  const s1 = card().locator("details.cms-step", { hasText: "Step 1:" });
  await s1.locator("summary").click();
  await s1
    .locator('textarea[name="prompt"]')
    .fill("Which ocean animal breathes air?");
  await s1.getByRole("button", { name: "Save step" }).click();
  await card()
    .getByText(/Step 1: Which ocean animal breathes air\?/)
    .waitFor();
  await card()
    .getByRole("button", { name: /Confirm age review & publish/ })
    .click();
  await card().getByText("v1 · retired").waitFor();
  await card().getByText("v2 · published").waitFor();
  const id = await start(g, TITLE);
  await g.getByText("Which ocean animal breathes air?").waitFor();
  await answerAll(g);
  const s = (await api(g, `/api/session?id=${id}`)).body;
  assert.equal(s.version.version, 2);
});

test("QZ-24: completion earns badges and a PRD level on the Passport", async () => {
  await g.goto(`${BASE}/passport`);
  await g
    .locator(".badge-list li.earned", { hasText: "First adventure" })
    .first()
    .waitFor();
  await g
    .locator(".badge-list.family li.earned", { hasText: "First game night" })
    .waitFor();
  await g
    .getByText(/Level 1 · Explorer/)
    .first()
    .waitFor();
  assert.ok(
    (await g.locator(".badge-list li.locked").count()) > 0,
    "locked badges shown honestly",
  );
  await scan(g, "passport-badges");
});

test("QZ-25: practice rounds play fully but record no XP or badges", async () => {
  const before = (await api(g, "/api/snapshot")).body;
  const xpBefore = before.scores.length;
  const badgesBefore = before.childBadges.length;
  const id = await start(g, "Curiosity kick-off", true);
  await g.getByText("Practice round", { exact: true }).waitFor();
  await scan(g, "practice-play");
  await answerAll(g);
  await g.getByText(/Practice round complete. Nothing was added/).waitFor();
  const snap = (await api(g, "/api/snapshot")).body;
  assert.equal(snap.scores.length, xpBefore, "no new score events");
  assert.equal(snap.childBadges.length, badgesBefore, "no new badges");
  await g.goto(`${BASE}/parent`);
  await g
    .getByText(/practice round \(no XP\)/)
    .first()
    .waitFor();
  void id;
});

test("QZ-26: Parent Hub progress by explorer and history beyond the newest 100", async () => {
  await g.goto(`${BASE}/parent`);
  const progress = g.locator(".progress-card", { hasText: "Marlin" });
  await progress.getByText(/Level 1 · Explorer/).waitFor();
  await progress.getByText(/Zones played: QuickZone/).waitFor();
  await scan(g, "parent-progress");
  operatorSql(`insert into public.game_sessions(household_id,challenge_version_id,state,created_at,expires_at,completed_at,total_score)
    select h.id, v.id, 'complete', now()-interval '40 days'-(n||' hours')::interval, now(), now()-interval '40 days'-(n||' hours')::interval, 50
    from public.households h join auth.users u on u.id=h.guardian_id,
         public.challenge_versions v join public.challenges c on c.id=v.challenge_id, generate_series(1,104) n
    where u.email='${G.email}' and c.title='Curiosity kick-off' and v.status='published'`);
  await g.reload();
  for (
    let i = 0;
    i < 30 &&
    !(await g
      .getByRole("button", { name: "Load older adventures" })
      .isVisible());
    i++
  )
    await g.getByRole("button", { name: /Show more/ }).click();
  assert.equal(
    await g.locator(".summary-card").count(),
    100,
    "the snapshot window",
  );
  await g.getByRole("button", { name: "Load older adventures" }).click();
  await g.waitForFunction(
    () => document.querySelectorAll(".summary-card").length > 100,
  );
  assert.ok((await g.locator(".summary-card").count()) > 100);
});

test("QZ-27: a new consent version gates new play until the guardian accepts", async () => {
  operatorSql(
    "insert into public.consent_versions(version,summary,body) values(2,'Adds SafeZone town halls','I consent to everything in version 1, and to SafeZone town hall participation when I approve each session.')",
  );
  await g.goto(`${BASE}/home`);
  const banner = g.locator(".consent-banner");
  await banner.getByText(/Updated family consent \(version 2\)/).waitFor();
  await scan(g, "consent-banner");
  await g.goto(`${BASE}/challenges`);
  await g
    .locator(".challenge-grid > div", { hasText: "Curiosity kick-off" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await g.getByRole("button", { name: /Create game night/ }).click();
  await g
    .locator("dialog")
    .getByText(/accept the updated family consent/)
    .waitFor();
  await g.goto(`${BASE}/home`);
  await banner.getByRole("button", { name: /I have read and accept/ }).click();
  await banner.waitFor({ state: "detached" });
  await g.goto(`${BASE}/parent`);
  await g
    .locator(".session-row", { hasText: "Consent version 1" })
    .getByText("superseded")
    .waitFor();
  await g
    .locator(".session-row", { hasText: "Consent version 2" })
    .getByText("current")
    .waitFor();
  const ex = (await api(g, "/api/account")).body;
  assert.deepEqual(
    ex.consentRecords.map((r: { version: number }) => r.version),
    [1, 2],
  );
});

test("QZ-28: staff operations tiles show aggregates only", async () => {
  await adm.goto(`${BASE}/admin`);
  const ops = adm.locator("section.ops");
  await ops.getByText("Households").waitFor();
  await ops.getByText("Pending re-consent").waitFor();
  const text = (await ops.textContent()) ?? "";
  assert.equal(
    text.includes("Marlin") || text.includes(G.email),
    false,
    "no personal data",
  );
  await scan(adm, "admin-ops");
  const denied = await api(g, "/api/ops");
  assert.equal(denied.status, 403);
});

test("QZ-29: the guardian's daily hint limit is shown and enforced", async () => {
  await g.goto(`${BASE}/family`);
  await g.check('input[name="q"]');
  await g.getByRole("button", { name: /Save family preferences/ }).click();
  await g.getByText("Saved to your family’s account.").waitFor();
  await g.locator('input[name="limit"]').fill("1");
  await g.getByRole("button", { name: "Save hint limit" }).click();
  await g.getByText("Daily hint limit saved.").waitFor();
  await scan(g, "family-hint-limit");
  const id = await start(g, "Curiosity kick-off");
  await g.getByRole("button", { name: /Ask for a hint/ }).click();
  await g.locator("p.hint").waitFor();
  await g.getByText("1 of 1 family hints used today.").waitFor();
  await g.getByRole("button", { name: /Ask for a hint/ }).click();
  await g.getByText(/used today's 1 guided hints/).waitFor();
  void id;
});

test("QZ-30: accessibility and layout across every new surface (390 + 1280)", () => {
  assert.deepEqual(a11y, {}, JSON.stringify(a11y, null, 1));
});

test("no uncaught client console errors", () => {
  assert.deepEqual(
    errors.filter((e) => !/status of 40[0134]|Failed to load resource/.test(e)),
    [],
  );
});
