// QZ-38: automation scenarios on a real app + Supabase stack.
// - CMS authoring for every non-Quick zone, with the server's age-band and
//   archived-explorer rules checked in each zone (previously DB-tested only).
// - The family inbox (QZ-36), scheduled maintenance (QZ-35), and the BuildZone
//   portfolio (QZ-37), end to end.
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
  email: `auto-${run}@example.test`,
  password: "Automation-Guardian-42!",
};
const ADM = {
  email: `auto-admin-${run}@example.test`,
  password: "Automation-Admin-42!",
};
const MODES = ["solve", "build", "debate", "world"] as const;
const title = (m: string) => `Teen ${m} lab ${run}`;
let browser: Browser, g: Page, adm: Page;
let young = "",
  teen = "";
const challenge: Record<string, string> = {};
const a11y: Record<string, unknown> = {};
const errors: string[] = [];

const cmd = (page: Page, action: string, data: unknown) =>
  api(page, "/api/command", { method: "POST", body: { action, data } });

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
  await page.setViewportSize({ width: 1280, height: 844 });
}
async function playToEnd(page: Page) {
  for (let i = 0; i < 12; i++) {
    const win = page.getByText("That’s a family win.");
    await page.locator(".answer-options label").first().or(win).waitFor();
    if (await win.isVisible()) return;
    const prev = await page.locator("h2").first().textContent();
    await page.locator(".answer-options label").first().click();
    await page.getByRole("button", { name: /Lock in our answer/ }).click();
    await page.waitForFunction(
      (p) =>
        document.querySelector("h2")?.textContent !== p ||
        document.body.textContent?.includes("That’s a family win."),
      prev,
    );
  }
  await page.getByText("That’s a family win.").waitFor();
}

before(async () => {
  browser = await chromium.launch();
  const pages: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const p = await (await browser.newContext()).newPage();
    p.on("console", (m) => {
      // Refusals are asserted on purpose; they log as failed fetches.
      if (m.type() === "error" && !/status of 4\d\d/.test(m.text()))
        errors.push(m.text());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
  }
  [g, adm] = pages;
  await signupAndConfirm(g, G);
  await createHousehold(g, `Auto Crew ${run}`, [
    ["Ivy", 9],
    ["Oak", 14],
  ]);
  await g.goto(`${BASE}/family`);
  await g.check('input[name="world"]');
  await g.getByRole("button", { name: /Save family preferences/ }).click();
  await g.getByText("Saved to your family’s account.").waitFor();
  const kids = operatorSql(
    `select string_agg(c.nickname||'='||c.id, ',') from public.child_profiles c join public.households h on h.id=c.household_id join auth.users u on u.id=h.guardian_id where u.email='${G.email}'`,
  );
  for (const kv of kids.split(",")) {
    const [n, id] = kv.split("=");
    if (n === "Ivy") young = id;
    if (n === "Oak") teen = id;
  }
  await signupAndConfirm(adm, ADM);
  operatorSql(
    `insert into private.staff select id,'admin' from auth.users where email='${ADM.email}'`,
  );
});
after(async () => {
  operatorSql(
    `delete from private.staff where user_id in (select id from auth.users where email='${ADM.email}')`,
  );
  await browser?.close();
});

test("A1. CMS authors a 13–17 challenge in every non-Quick zone; age bands hold in each", async () => {
  for (const m of MODES) {
    const d = await cmd(adm, "draft", {
      title: title(m),
      mode: m,
      scenario: `A ${m} challenge written for older explorers to talk through together.`,
      prompt: "Which plan would you test first, and why?",
      options: ["The cheapest plan", "The plan with the most evidence"],
      correct: 1,
      hint: "Think about which plan you could actually check.",
      explanation: "Evidence lets the family compare plans fairly.",
    });
    assert.equal(d.status, 200, `draft ${m}: ${JSON.stringify(d.body)}`);
    const version = operatorSql(
      `select v.id from public.challenge_versions v join public.challenges c on c.id=v.challenge_id where c.title='${title(m)}'`,
    );
    const ages = await cmd(adm, "cms_version_update", {
      version,
      scenario: `A ${m} challenge written for older explorers to talk through together.`,
      minAge: 13,
      maxAge: 17,
    });
    assert.equal(ages.status, 200, `ages ${m}: ${JSON.stringify(ages.body)}`);
    if (m === "world") {
      // The quality gate requires a country; the admin sets it in the CMS.
      await adm.goto(`${BASE}/admin`);
      const card = adm.locator("article", { hasText: title(m) });
      await card.locator('input[name="country"]').fill("Kenya");
      await card.getByRole("button", { name: "Save country" }).click();
      await adm.getByText("Saved with an audit record.").waitFor();
    }
    const pub = await cmd(adm, "publish", { version, ageReviewed: true });
    assert.equal(pub.status, 200, `publish ${m}: ${JSON.stringify(pub.body)}`);
    challenge[m] = operatorSql(
      `select id from public.challenges where title='${title(m)}'`,
    );
  }
  await g.goto(`${BASE}/challenges`);
  for (const m of MODES)
    await g.locator(".challenge-grid > div", { hasText: title(m) }).waitFor();
  await scan(g, "challenges-cms-every-zone");
  for (const m of MODES) {
    const tooYoung = await cmd(g, "create", {
      challenge: challenge[m],
      children: [young],
    });
    assert.ok(tooYoung.status >= 400, `${m} too young`);
    assert.match(String(tooYoung.body?.error), /unavailable|eligible/i, m);
  }
});

test("A2. archived explorers are refused in every zone; active ones can play a CMS challenge end to end", async () => {
  operatorSql(
    `update public.child_profiles set archived_at=now() where id='${teen}'`,
  );
  try {
    for (const m of MODES) {
      const r = await cmd(g, "create", {
        challenge: challenge[m],
        children: [teen],
      });
      assert.ok(r.status >= 400, `${m} archived`);
      assert.match(String(r.body?.error), /active explorers/i, m);
    }
  } finally {
    operatorSql(
      `update public.child_profiles set archived_at=null where id='${teen}'`,
    );
  }
  const ok = await cmd(g, "create", {
    challenge: challenge.debate,
    children: [teen],
  });
  assert.equal(ok.status, 200);
  const session = (ok.body as { session: string }).session;
  await g.goto(`${BASE}/play/${session}`);
  await g.getByRole("button", { name: /Our crew is ready/ }).click();
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  await playToEnd(g);
  await g.getByText(title("debate")).first().waitFor();
});

test("A3. the family inbox shows earned badges and report reviews; read state persists", async () => {
  await g.goto(`${BASE}/parent`);
  const inbox = g.locator(".family-inbox");
  await inbox.getByRole("heading", { name: /Family inbox/ }).waitFor();
  await inbox
    .getByText(/Oak earned/)
    .first()
    .waitFor();
  await g.locator(".sidebar-bottom .nav-badge").first().waitFor();
  await scan(g, "parent-inbox");
  // A report, reviewed by staff, reaches the inbox.
  const session = operatorSql(
    `select g.id from public.game_sessions g join public.households h on h.id=g.household_id join auth.users u on u.id=h.guardian_id where u.email='${G.email}' order by g.created_at desc limit 1`,
  );
  assert.equal(
    (await cmd(g, "report", { session, reason: "incorrect" })).status,
    200,
  );
  const caseId = operatorSql(
    `select id from public.moderation_cases where session_id='${session}'`,
  );
  assert.equal(
    (await cmd(adm, "review", { caseId, status: "under_review" })).status,
    200,
  );
  await g.reload();
  await inbox.getByText("A report is being reviewed").waitFor();
  const first = inbox.locator(".inbox-list li.unread").first();
  const name = (await first.locator("strong").textContent()) || "";
  await first.getByRole("button", { name: /Mark .* as read/ }).click();
  await inbox
    .locator(".inbox-list li.read", { hasText: name })
    .first()
    .waitFor();
  await inbox.getByRole("button", { name: /Mark all read/ }).click();
  await inbox.getByText("All caught up").waitFor();
  await g.reload();
  await inbox.getByText("All caught up").waitFor();
  assert.equal(await g.locator(".sidebar-bottom .nav-badge").count(), 0);
});

test("A4. scheduled maintenance: admin runs it; stale games expire; reminders reach the inbox once", async () => {
  // A lobby left past its time limit, and a game night in three hours.
  const stale = await cmd(g, "create", {
    challenge: challenge.solve,
    children: [teen],
  });
  const staleId = (stale.body as { session: string }).session;
  operatorSql(
    `update public.game_sessions set expires_at=now()-interval '1 minute' where id='${staleId}'`,
  );
  const at = new Date(Date.now() + 3 * 3600e3).toISOString();
  assert.equal((await cmd(g, "schedule", { at, mode: "debate" })).status, 200);
  assert.equal((await api(g, "/api/maintenance")).status, 403);
  await adm.goto(`${BASE}/admin`);
  const panel = adm.locator(".maintenance-panel");
  await panel.getByRole("heading", { name: "Scheduled maintenance" }).waitFor();
  await panel.getByRole("button", { name: /Run now/ }).click();
  await panel
    .locator(".maintenance-runs li", { hasText: "operator" })
    .first()
    .waitFor();
  await panel
    .getByText(/reminders sent [1-9]/)
    .first()
    .waitFor();
  await scan(adm, "admin-maintenance");
  const state = operatorSql(
    `select state from public.game_sessions where id='${staleId}'`,
  );
  assert.equal(state, "expired");
  await g.goto(`${BASE}/parent`);
  await g.locator(".family-inbox").getByText("Game night coming up").waitFor();
  // Idempotent: running again doesn't repeat the reminder.
  await panel.getByRole("button", { name: /Run now/ }).click();
  await panel.getByRole("button", { name: /Run now/ }).waitFor();
  const n = operatorSql(
    `select count(*) from public.family_notifications f join public.households h on h.id=f.household_id join auth.users u on u.id=h.guardian_id where u.email='${G.email}' and f.kind='game_night'`,
  );
  assert.equal(n, "1");
});

test("A5. the BuildZone portfolio shows the family's saved design", async () => {
  await g.goto(`${BASE}/passport`);
  await g.getByRole("heading", { name: /Our designs/ }).waitFor();
  await g.getByText(/Designs you save in BuildZone appear here/).waitFor();
  await g.goto(`${BASE}/challenges`);
  await g
    .locator(".challenge-grid > div", { hasText: "The brilliant bus stop" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await g.getByRole("button", { name: /Create game night/ }).click();
  await g.waitForURL(/\/play\/[0-9a-f-]{36}/);
  await g.getByRole("button", { name: /Our crew is ready/ }).click();
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  for (const f of ["Rain cover", "Step-free path"])
    await g.locator(".design-choice", { hasText: f }).locator("input").check();
  await g.getByRole("button", { name: /Save our shelter design/ }).click();
  await playToEnd(g);
  await g.goto(`${BASE}/passport`);
  const card = g.locator(".portfolio-grid > li", {
    hasText: "The brilliant bus stop",
  });
  await card.getByText("$6,500 of $10,000").waitFor();
  await card.getByText("✓ Rain cover").waitFor();
  await card.getByText("– Community mural").waitFor();
  await scan(g, "passport-portfolio");
});

test("A6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface", () => {
  assert.deepEqual(a11y, {});
});

test("A7. no uncaught client console errors", () => {
  assert.deepEqual(errors, []);
});
