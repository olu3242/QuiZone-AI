// QZ-06: browser journeys for SolveZone, BuildZone, DebateZone, WorldZone, Q hints,
// game report → staff review, CMS draft → publish, and zone kill switches.
// Real app + real Supabase; operator-only actions run as SQL.
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
  email: `zones-${run}@example.test`,
  password: "Zones-Guardian-42!",
};
const O = {
  email: `zones-other-${run}@example.test`,
  password: "Zones-Other-42!",
};
const ADM = {
  email: `zones-admin-${run}@example.test`,
  password: "Zones-Admin-42!",
};
const DRAFT = `Night sky quiz ${run}`;
let browser: Browser, g: Page, o: Page, adm: Page;
const sessions: Record<string, string> = {};
const a11y: Record<string, unknown> = {};
const errors: string[] = [];
type Saved = {
  session: { state: string; total_score: number };
  answers: {
    points: number;
    allocation: Record<string, number> | null;
    design: Record<string, boolean> | null;
  }[];
  steps: { id: string }[];
};
const saved = async (id: string) =>
  (await api(g, `/api/session?id=${id}`)).body as Saved;
const flag = (name: string, on: boolean) =>
  operatorSql(
    `update private.feature_flags set enabled=${on} where flag='${name}'`,
  );

async function start(page: Page, title: string) {
  await page.goto(`${BASE}/challenges`);
  await page
    .locator(".challenge-grid > div", { hasText: title })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await page.getByRole("button", { name: /Create game night/ }).click();
  await page.waitForURL(/\/play\/[0-9a-f-]{36}/);
  const id = page.url().split("/play/")[1];
  await page.getByRole("button", { name: /Our crew is ready/ }).click();
  await page.getByRole("button", { name: /Start the adventure/ }).click();
  return id;
}
async function answerChoices(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    const before = await page.locator("h2").first().textContent();
    await page.locator(".answer-options label").nth(1).click();
    await page.getByRole("button", { name: /Lock in our answer/ }).click();
    if (i < count - 1)
      await page.waitForFunction(
        (p) => document.querySelector("h2")?.textContent !== p,
        before,
      );
  }
}
async function scan(page: Page, key: string) {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (over) a11y[`${key}@${width}:overflow`] = true;
    const v = await axe(page, AXE);
    if (v.length) a11y[`${key}@${width}`] = v;
  }
  await page.setViewportSize({ width: 1280, height: 800 });
}

before(async () => {
  browser = await chromium.launch();
  [g, o, adm] = await Promise.all(
    [1, 2, 3].map(async () => (await browser.newContext()).newPage()),
  );
  for (const p of [g, o, adm])
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await signupAndConfirm(g, G);
  await createHousehold(g, `Zones Crew ${run}`, [["Comet", 11]]);
});
after(async () => {
  await browser?.close();
});

test("1. SolveZone: budget guard on client and server, saved plan, events, completion", async () => {
  const id = (sessions.solve = await start(g, "Power the Island"));
  const field = (label: string) =>
    g.locator(".allocation label", { hasText: label }).locator("input");
  await field("Solar").fill("100000");
  await field("Wind").fill("10000");
  assert.equal(
    await g
      .getByRole("button", { name: /Submit our island plan/ })
      .isDisabled(),
    true,
    "client blocks overspend",
  );
  const step = (await saved(id)).steps[0].id;
  const forged = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "plan",
      data: {
        session: id,
        step,
        allocation: {
          solar: 100000,
          wind: 10000,
          battery: 0,
          diesel: 0,
          grid: 0,
          efficiency: 0,
        },
      },
    },
  });
  assert.equal(
    forged.status,
    400,
    "server rejects overspend even when the UI is bypassed",
  );
  for (const [label, v] of [
    ["Solar", "35000"],
    ["Wind", "30000"],
    ["Battery storage", "20000"],
    ["Energy efficiency", "10000"],
  ])
    await field(label).fill(v);
  await scan(g, "solve-allocation");
  await g.getByRole("button", { name: /Submit our island plan/ }).click();
  await g.locator(".answer-options").waitFor();
  await answerChoices(g, 2);
  await g.getByText("That’s a family win.").waitFor();
  const s = await saved(id);
  assert.equal(s.session.state, "complete");
  assert.deepEqual(s.answers[0].allocation, {
    solar: 35000,
    wind: 30000,
    battery: 20000,
    diesel: 0,
    grid: 0,
    efficiency: 10000,
  });
  assert.equal(
    s.session.total_score,
    s.answers.reduce((t, a) => t + a.points, 0),
  );
});

test("2. BuildZone: costed blueprint, overspend refused, design saved, pitch steps complete", async () => {
  const id = (sessions.build = await start(g, "The brilliant bus stop"));
  for (const f of [
    "Rain cover",
    "Step-free path",
    "Comfortable seats",
    "Solar lighting",
    "Community mural",
  ])
    await g.locator(".design-choice", { hasText: f }).locator("input").check();
  await g.getByText("$12,000 selected").waitFor();
  assert.equal(
    await g
      .getByRole("button", { name: /Save our shelter design/ })
      .isDisabled(),
    true,
  );
  const step = (await saved(id)).steps[0].id;
  const forged = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "blueprint",
      data: {
        session: id,
        step,
        design: {
          roof: true,
          access: true,
          seating: true,
          lighting: true,
          mural: true,
        },
      },
    },
  });
  assert.equal(forged.status, 400);
  for (const f of ["Solar lighting", "Community mural"])
    await g
      .locator(".design-choice", { hasText: f })
      .locator("input")
      .uncheck();
  await g.getByText("$8,500 selected").waitFor();
  await scan(g, "build-blueprint");
  await g.getByRole("button", { name: /Save our shelter design/ }).click();
  await g.locator(".answer-options").waitFor();
  await answerChoices(g, 2);
  await g.getByText("That’s a family win.").waitFor();
  const s = await saved(id);
  assert.deepEqual(s.answers[0].design, {
    roof: true,
    access: true,
    seating: true,
    lighting: false,
    mural: false,
  });
  assert.equal(
    operatorSql(
      `select total_cost from public.build_submissions where session_id='${id}'`,
    ),
    "8500",
  );
});

test("3. DebateZone: six fixed stages, no free-text field anywhere, completion", async () => {
  const id = (sessions.debate = await start(g, "A park for everyone"));
  await g.locator(".answer-options").waitFor();
  assert.equal(
    await g
      .locator("main textarea, main input[type=text], main input:not([type])")
      .count(),
    0,
    "no free-text input",
  );
  await scan(g, "debate-stage");
  await answerChoices(g, 6);
  await g.getByText("That’s a family win.").waitFor();
  const s = await saved(id);
  assert.equal(s.answers.length, 6);
  assert.equal(s.session.state, "complete");
});

test("4. Q hints: off by default, guardian enables, hint logged in Parent Hub, operator pause respected", async () => {
  const id = (sessions.quick = await start(g, "Curiosity kick-off"));
  await g.getByRole("button", { name: /Ask for a hint/ }).click();
  await g.getByText(/Guided hints are unavailable/).waitFor();
  await g.goto(`${BASE}/family`);
  await g.check('input[name="q"]');
  await g.getByRole("button", { name: /Save family preferences/ }).click();
  await g.getByText("Saved to your family’s account.").waitFor();
  await g.goto(`${BASE}/play/${id}`);
  await g.getByRole("button", { name: /Ask for a hint/ }).click();
  const hint = await g.locator("p.hint").textContent();
  assert.ok(hint && hint.length > 10);
  await g.goto(`${BASE}/parent`);
  await g.getByText(hint!).first().waitFor();
  flag("q_hints", false);
  await g.goto(`${BASE}/play/${id}`);
  await g.getByText("Hints are paused right now.").waitFor();
  assert.equal(
    await g.getByRole("button", { name: /Ask for a hint/ }).isDisabled(),
    true,
  );
  const direct = await api(g, "/api/command", {
    method: "POST",
    body: { action: "hint", data: { session: id } },
  });
  assert.equal(direct.status, 400);
  assert.match(direct.body.error, /paused/);
  flag("q_hints", true);
});

test("5. game report → admin review → guardian sees the decision", async () => {
  await g.goto(`${BASE}/play/${sessions.quick}`);
  await g.locator("#report-reason").selectOption("incorrect");
  await g.getByRole("button", { name: "Submit report" }).click();
  await g.getByText(/report is saved for review/).waitFor();
  await signupAndConfirm(adm, ADM);
  operatorSql(
    `insert into private.staff select id,'admin' from auth.users where email='${ADM.email}'`,
  );
  await adm.goto(`${BASE}/admin`);
  const card = adm.locator(".summary-card", { hasText: "incorrect" }).first();
  await card.getByRole("button", { name: "under review" }).click();
  await adm.getByText("Saved with an audit record.").waitFor();
  await card.getByRole("button", { name: "actioned" }).click();
  await adm.getByText("Saved with an audit record.").waitFor();
  await g.goto(`${BASE}/parent`);
  await g
    .locator(".session-row", { hasText: "incorrect" })
    .getByText("actioned")
    .waitFor();
  const forged = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "review",
      data: {
        caseId: operatorSql("select id from public.moderation_cases limit 1"),
        status: "dismissed",
      },
    },
  });
  assert.ok(forged.status >= 400, "a guardian cannot review cases");
});

test("6. CMS: admin draft is invisible and unplayable until age review + publish", async () => {
  await adm.goto(`${BASE}/admin`);
  await adm.locator('input[name="title"]').fill(DRAFT);
  await adm.locator('select[name="mode"]').selectOption("quick");
  await adm
    .locator('textarea[name="scenario"]')
    .fill("Look up together and talk about what you can see in the night sky.");
  await adm
    .locator('textarea[name="prompt"]')
    .fill("Which object in our sky is a star?");
  await adm.locator('textarea[name="options"]').fill("The Sun\nThe Moon");
  await adm.locator('input[name="correct"]').fill("0");
  await adm
    .locator('textarea[name="hint"]')
    .fill("It makes its own light and heat.");
  await adm
    .locator('textarea[name="explanation"]')
    .fill("The Sun is a star; the Moon reflects its light.");
  await adm.getByRole("button", { name: "Save draft" }).click();
  await adm.getByText("Saved with an audit record.").waitFor();
  await g.goto(`${BASE}/challenges`);
  assert.equal(
    await g.getByText(DRAFT).count(),
    0,
    "guardian cannot see the draft",
  );
  assert.equal(
    JSON.stringify((await api(g, "/api/snapshot")).body).includes(DRAFT),
    false,
  );
  adm.once("dialog", (d) => void d.accept());
  await adm
    .locator(".summary-card", { hasText: DRAFT })
    .getByRole("button", { name: /Confirm age review & publish/ })
    .click();
  await adm.getByText("Saved with an audit record.").waitFor();
  const id = await start(g, DRAFT);
  await answerChoices(g, 1);
  await g.getByText("That’s a family win.").waitFor();
  assert.equal((await saved(id)).session.state, "complete");
});

test("7. WorldZone: permission gate, completion, household-private passport stamp", async () => {
  await g.goto(`${BASE}/challenges`);
  await g
    .locator(".challenge-grid > div", { hasText: "Water-wise cities" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await g.getByRole("button", { name: /Create game night/ }).click();
  await g.getByText(/enable WorldZone/).waitFor();
  await g.goto(`${BASE}/family`);
  await g.check('input[name="world"]');
  await g.getByRole("button", { name: /Save family preferences/ }).click();
  await g.getByText("Saved to your family’s account.").waitFor();
  const id = (sessions.world = await start(g, "Water-wise cities"));
  await scan(g, "world-step");
  await answerChoices(g, 3);
  await g.getByText("That’s a family win.").waitFor();
  await g.goto(`${BASE}/passport`);
  await g.locator(".stamp", { hasText: "Singapore" }).first().waitFor();
  await scan(g, "passport");
  await signupAndConfirm(o, O);
  await createHousehold(o, `Zones Other ${run}`, [["Nebula", 12]]);
  await o.goto(`${BASE}/passport`);
  assert.equal(
    await o.locator(".stamp").count(),
    0,
    "other household has no stamps",
  );
  for (const sid of Object.values(sessions))
    assert.equal((await api(o, `/api/session?id=${sid}`)).status, 404);
  void id;
});

test("8. operator kill switch: a paused zone is shown as paused and refused by the server", async () => {
  flag("zone_build", false);
  await g.goto(`${BASE}/challenges`);
  const card = g.locator(".challenge-grid > div", {
    hasText: "The brilliant bus stop",
  });
  assert.equal(
    await card.getByRole("button", { name: "Paused for now" }).isDisabled(),
    true,
  );
  const challenge = operatorSql(
    "select id from public.challenges where mode='build' and title='The brilliant bus stop'",
  );
  const kid = operatorSql(
    `select c.id from public.child_profiles c join public.households h on h.id=c.household_id join auth.users u on u.id=h.guardian_id where u.email='${G.email}'`,
  );
  const r = await api(g, "/api/command", {
    method: "POST",
    body: { action: "create", data: { challenge, children: [kid] } },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /paused/);
  flag("zone_world", false);
  await g.goto(`${BASE}/world`);
  await g.getByText(/WorldZone is paused right now/).waitFor();
  flag("zone_build", true);
  flag("zone_world", true);
  await g.goto(`${BASE}/challenges`);
  await card.getByRole("button", { name: /Choose this adventure/ }).waitFor();
});

test("9. accessibility and layout across every zone surface (390 + 1280)", async () => {
  for (const [page, path, key] of [
    [g, "/world", "world"],
    [g, "/challenges", "challenges"],
    [adm, "/admin", "admin"],
    [g, `/play/${sessions.solve}`, "solve-results"],
    [g, `/play/${sessions.debate}`, "debate-results"],
  ] as const) {
    await page.goto(BASE + path);
    await page.waitForLoadState("networkidle");
    await scan(page, key);
  }
  assert.deepEqual(a11y, {}, JSON.stringify(a11y, null, 1));
});

test("10. no uncaught client console errors", () => {
  assert.deepEqual(
    errors.filter((e) => !/status of 40[0134]|Failed to load resource/.test(e)),
    [],
  );
});
