// QZ-31: guardian-invited family members, multi-device play, on a real app + Supabase stack.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Browser, Page } from "playwright";
import { BASE, api, axe, createHousehold, signupAndConfirm } from "./support";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const AXE = process.env.E2E_AXE_PATH || require.resolve("axe-core/axe.min.js");
const run = Date.now().toString(36);
const G = {
  email: `members-g-${run}@example.test`,
  password: "Members-Guardian-42!",
};
const M = {
  email: `members-m-${run}@example.test`,
  password: "Members-Member-42!",
};
const HOUSE = `Relay Crew ${run}`;
let browser: Browser, g: Page, m: Page;
let code = "",
  session = "";
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
  const pages: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const p = await (await browser.newContext()).newPage();
    p.on("console", (msg) => {
      // Expected refusals surface as failed fetches in the console; ignore those.
      if (msg.type() === "error" && !/status of 4\d\d/.test(msg.text()))
        errors.push(msg.text());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
  }
  [g, m] = pages;
  await signupAndConfirm(g, G);
  await createHousehold(g, HOUSE, [["Juniper", 10]]);
  await signupAndConfirm(m, M);
});
after(async () => {
  await browser?.close();
});

test("M1. guardian creates a single-use invite code, shown once", async () => {
  await g.goto(`${BASE}/family`);
  await g.getByRole("heading", { name: /Family adults/ }).waitFor();
  await g.getByRole("button", { name: /Create an invite code/ }).click();
  code = (await g.locator(".invite-code code").textContent()) || "";
  assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  await g.getByText(/We won’t show it again/).waitFor();
  await g.getByRole("heading", { name: "Unused invites" }).waitFor();
  await scan(g, "family-guardian-invite");
  // After a reload the code is gone; only the invite's dates remain.
  await g.reload();
  await g.getByRole("heading", { name: "Unused invites" }).waitFor();
  assert.equal(await g.locator(".invite-code").count(), 0);
  assert.ok(!(await g.content()).includes(code));
});

test("M2. an adult joins with the code; a wrong code is refused", async () => {
  await m.goto(`${BASE}/family`);
  await m
    .getByRole("heading", { name: /Invited by your family’s guardian/ })
    .waitFor();
  await scan(m, "family-join");
  await m.fill('input[name="code"]', "0000-0000-0000");
  await m.fill('input[name="displayName"]', "Aunt Bea");
  await m.getByRole("button", { name: /Join this family/ }).click();
  await m.getByText(/invalid or has expired/).waitFor();
  await m.fill('input[name="code"]', code.toLowerCase());
  await m.getByRole("button", { name: /Join this family/ }).click();
  await m.getByRole("heading", { name: HOUSE }).waitFor();
  await m.getByRole("heading", { name: /You’re a family member/ }).waitFor();
  await m.getByText("Juniper").waitFor();
  await scan(m, "family-member");
  // The guardian sees them listed; the used invite is gone.
  await g.reload();
  await g.locator(".member-list", { hasText: "Aunt Bea" }).waitFor();
  assert.equal(
    await g.getByRole("heading", { name: "Unused invites" }).count(),
    0,
  );
});

test("M3. members get no guardian controls, in the UI or the API", async () => {
  await m.goto(`${BASE}/home`);
  const nav = m.getByRole("navigation", { name: "Family navigation" });
  await nav.getByRole("link", { name: /Home/ }).waitFor();
  assert.equal(await nav.getByRole("link", { name: /SafeZone/ }).count(), 0);
  assert.equal(await m.getByRole("link", { name: /Parent Hub/ }).count(), 0);
  await m.goto(`${BASE}/parent`);
  await m.getByText(/Parent Hub is for the family’s guardian/).waitFor();
  await m.goto(`${BASE}/safezone`);
  await m.getByText(/SafeZone is for the family’s guardian/).waitFor();
  await m.goto(`${BASE}/family`);
  assert.equal(
    await m.getByRole("button", { name: /Add to the crew/ }).count(),
    0,
  );
  assert.equal(
    await m.getByRole("link", { name: /Download family data/ }).count(),
    0,
  );
  for (const [action, data] of [
    [
      "child",
      { nickname: "Sneaky", age: 9, avatar: "fox", interest: "nature" },
    ],
    ["permissions", { world: true, q: true, minutes: 120 }],
    ["q_budget", { limit: 50 }],
    ["member_invite", {}],
  ] as const) {
    const r = await api(m, "/api/command", {
      method: "POST",
      body: { action, data },
    });
    assert.ok(r.status >= 400, action);
    assert.match(String(r.body?.error), /guardian/i, action);
  }
  const exp = await api(m, "/api/account");
  assert.equal(exp.status, 404);
});

test("M4. a member hosts on their own device; both devices see the same live game", async () => {
  await m.goto(`${BASE}/challenges`);
  await m
    .locator(".challenge-grid > div", { hasText: "Curiosity kick-off" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await m.getByRole("button", { name: /Create game night/ }).click();
  await m.waitForURL(/\/play\/[0-9a-f-]{36}/);
  session = m.url().split("/play/")[1];
  await m.getByText(/Aunt Bea \(this device\)/).waitFor();
  // The guardian opens it on the shared screen and is listed on both devices.
  await g.goto(`${BASE}/play/${session}`);
  await g.getByText(/Guardian \(this device\)/).waitFor();
  await g.locator(".devices", { hasText: "Aunt Bea" }).waitFor();
  await m
    .locator(".devices", { hasText: "Guardian" })
    .waitFor({ timeout: 15000 });
  await scan(g, "lobby-devices");
  // A transition on one device reaches the other.
  await m.getByRole("button", { name: /Our crew is ready/ }).click();
  await g
    .getByRole("button", { name: /Start the adventure/ })
    .waitFor({ timeout: 10000 });
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  // The guardian answers on the shared screen; the member's device follows.
  const first = await g.locator("h2").first().textContent();
  await g.locator(".answer-options label").first().click();
  await g.getByRole("button", { name: /Lock in our answer/ }).click();
  await m.waitForFunction(
    (p) => document.querySelector("h2")?.textContent !== p,
    first,
    { timeout: 15000 },
  );
  // The guardian's Home lists the member-hosted game.
  await g.goto(`${BASE}/home`);
  await g.locator(`a[href="/play/${session}"]`).first().waitFor();
});

test("M5. removing a member ends their access immediately", async () => {
  await g.goto(`${BASE}/family`);
  await g.getByRole("button", { name: "Remove Aunt Bea" }).click();
  await g.getByText(/Aunt Bea no longer has access/).waitFor();
  const r = await api(m, `/api/session?id=${session}`);
  assert.equal(r.status, 404);
  await m.goto(`${BASE}/family`);
  await m
    .getByRole("heading", { name: /Invited by your family’s guardian/ })
    .waitFor();
});

test("M6. accessibility (axe WCAG 2.2 AA) and no overflow on every new surface", () => {
  assert.deepEqual(a11y, {});
});

test("M7. no uncaught client console errors", () => {
  assert.deepEqual(errors, []);
});
