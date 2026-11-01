// QZ-32: Explorer mode on the shared screen, on a real app + Supabase stack.
// The lock is server-side (bound to the Auth session); these tests try to get
// around it from the browser and from the Supabase API directly.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Browser, BrowserContext, Page } from "playwright";
import {
  BASE,
  KEY,
  SUPA,
  accessToken,
  api,
  axe,
  createHousehold,
  signupAndConfirm,
} from "./support";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const AXE = process.env.E2E_AXE_PATH || require.resolve("axe-core/axe.min.js");
const run = Date.now().toString(36);
const G = {
  email: `explorer-${run}@example.test`,
  password: "Explorer-Guardian-42!",
};
const HOUSE = `Lantern Crew ${run}`;
let browser: Browser, ctx: BrowserContext, g: Page;
const a11y: Record<string, unknown> = {};
const errors: string[] = [];

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

before(async () => {
  browser = await chromium.launch();
  ctx = await browser.newContext();
  g = await ctx.newPage();
  g.on("console", (msg) => {
    // Refusals are the point of this suite; they log as failed fetches.
    if (msg.type() === "error" && !/status of 4\d\d/.test(msg.text()))
      errors.push(msg.text());
  });
  g.on("pageerror", (e) => errors.push(e.message));
  await signupAndConfirm(g, G);
  await createHousehold(g, HOUSE, [
    ["Wren", 9],
    ["Ash", 12],
  ]);
});
after(async () => {
  await browser?.close();
});

test("X1. an adult turns on Explorer mode; explorers get their own dashboard", async () => {
  await g.goto(`${BASE}/home`);
  await g.getByRole("button", { name: /Turn on Explorer mode/ }).click();
  await g.getByRole("heading", { name: "Ready for an adventure?" }).waitFor();
  await g.locator(".explorer-crew", { hasText: "Wren" }).waitFor();
  await g
    .locator(".explorer-crew", { hasText: "Level 1 · Explorer" })
    .first()
    .waitFor();
  await g.getByText("Explorer mode", { exact: true }).first().waitFor();
  const nav = g.getByRole("navigation", { name: "Family navigation" });
  assert.equal(await nav.getByRole("link", { name: /Family/ }).count(), 0);
  assert.equal(await nav.getByRole("link", { name: /SafeZone/ }).count(), 0);
  assert.equal(await g.getByRole("link", { name: /Parent Hub/ }).count(), 0);
  assert.equal(await g.getByRole("button", { name: /Sign out/ }).count(), 0);
  await scan(g, "explorer-home");
});

test("X2. guardian areas are closed in the UI, the app API, and Supabase directly", async () => {
  for (const path of ["/family", "/parent", "/safezone", "/admin"]) {
    await g.goto(`${BASE}${path}`);
    await g
      .getByRole("heading", { name: "This part is for grown-ups." })
      .waitFor();
  }
  await scan(g, "explorer-locked-page");
  const cmd = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "permissions",
      data: { world: true, q: true, minutes: 120 },
    },
  });
  assert.ok(cmd.status >= 400);
  assert.match(String(cmd.body?.error), /Explorer mode is on/);
  const cursor = `/api/history?before=${encodeURIComponent(new Date().toISOString())}`;
  for (const path of ["/api/account", cursor])
    assert.equal((await api(g, path)).status, 403, path);
  const pw = await api(g, "/api/account", {
    method: "POST",
    body: {
      action: "change-password",
      current: G.password,
      next: "Another-Password-99!",
    },
  });
  assert.equal(pw.status, 403);
  // With the session's own token, straight at Supabase: still locked.
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${await accessToken(ctx)}`,
    "Content-Type": "application/json",
  };
  const rpc = await fetch(`${SUPA}/rest/v1/rpc/qz_command`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      command: "child_archive",
      payload: {
        child: "00000000-0000-4000-8000-000000000000",
        archived: true,
      },
    }),
  });
  assert.equal(rpc.status, 400);
  assert.match(JSON.stringify(await rpc.json()), /Explorer mode is on/);
  for (const table of ["audit_events", "consent_records", "moderation_cases"]) {
    const r = await fetch(`${SUPA}/rest/v1/${table}?select=*`, { headers });
    assert.equal(r.status, 200, table);
    assert.deepEqual(await r.json(), [], table);
  }
  const locked = await fetch(`${SUPA}/rest/v1/rpc/qz_locked`, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(await locked.json(), true);
  // A wrong password doesn't unlock.
  const wrong = await api(g, "/api/explorer", {
    method: "POST",
    body: { password: "not-the-password" },
  });
  assert.equal(wrong.status, 403);
});

test("X3. play works while locked, start to finish", async () => {
  await g.goto(`${BASE}/home`);
  await g.getByRole("link", { name: /Pick an adventure/ }).click();
  await g
    .locator(".challenge-grid > div", { hasText: "Curiosity kick-off" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await g.getByRole("button", { name: /Create game night/ }).click();
  await g.waitForURL(/\/play\/[0-9a-f-]{36}/);
  await g.getByRole("button", { name: /Our crew is ready/ }).click();
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  for (let i = 0; i < 12; i++) {
    const win = g.getByText("That’s a family win.");
    await g.locator(".answer-options label").first().or(win).waitFor();
    if (await win.isVisible()) break;
    const prev = await g.locator("h2").first().textContent();
    await g.locator(".answer-options label").first().click();
    await g.getByRole("button", { name: /Lock in our answer/ }).click();
    await g.waitForFunction(
      (p) =>
        document.querySelector("h2")?.textContent !== p ||
        document.body.textContent?.includes("That’s a family win."),
      prev,
    );
  }
  await g.getByText("That’s a family win.").waitFor();
  assert.equal(
    await g.getByRole("link", { name: /View parent summary/ }).count(),
    0,
  );
});

test("X4. the lock survives reloads and new tabs (it isn't client state)", async () => {
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}/home`);
  await tab.getByRole("heading", { name: "Ready for an adventure?" }).waitFor();
  await tab.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await tab.reload();
  await tab.getByRole("heading", { name: "Ready for an adventure?" }).waitFor();
  await tab.close();
});

test("X5. the grown-up unlocks with their password; everything returns", async () => {
  await g.goto(`${BASE}/home`);
  await g.getByRole("button", { name: /Grown-up unlock/ }).click();
  await g.getByRole("heading", { name: "Leave Explorer mode" }).waitFor();
  await scan(g, "unlock-dialog");
  await g.fill('dialog input[name="password"]', "wrong-password-123");
  await g
    .locator("dialog")
    .getByRole("button", { name: /Unlock/ })
    .click();
  await g
    .locator("dialog")
    .getByText(/didn’t match/)
    .waitFor();
  await g.fill('dialog input[name="password"]', G.password);
  await g
    .locator("dialog")
    .getByRole("button", { name: /Unlock/ })
    .click();
  await g
    .getByRole("heading", { name: new RegExp(`Hello, ${HOUSE}`) })
    .waitFor();
  await g
    .getByRole("link", { name: /Parent Hub/ })
    .first()
    .waitFor();
  await g.goto(`${BASE}/parent`);
  await g
    .getByText(/Curiosity kick-off/)
    .first()
    .waitFor();
  const r = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "permissions",
      data: { world: true, q: true, minutes: 45 },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(
    (
      await api(
        g,
        `/api/history?before=${encodeURIComponent(new Date().toISOString())}`,
      )
    ).status,
    200,
  );
});

test("X6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface", () => {
  assert.deepEqual(a11y, {});
});

test("X7. no uncaught client console errors", () => {
  assert.deepEqual(errors, []);
});
