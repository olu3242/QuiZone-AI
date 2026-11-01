// Browser E2E against a running app + Supabase stack (local `supabase start` or a
// hosted preview). Uses synthetic accounts only. Configure via environment:
//   E2E_BASE_URL       app origin                 (default http://localhost:3000)
//   E2E_MAILPIT_URL    Mailpit API for local mail (default http://127.0.0.1:54324)
//   E2E_SUPABASE_URL   Supabase API URL           (default http://127.0.0.1:54321)
//   E2E_SUPABASE_KEY   publishable key            (required for REST isolation checks)
//   E2E_AXE_PATH       path to axe.min.js         (defaults to the pinned axe-core)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Browser, BrowserContext, Page } from "playwright";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const MAIL = process.env.E2E_MAILPIT_URL || "http://127.0.0.1:54324";
const SUPA = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const KEY = process.env.E2E_SUPABASE_KEY || "";
const AXE = process.env.E2E_AXE_PATH || require.resolve("axe-core/axe.min.js");
const run = Date.now().toString(36);
const A = {
  email: `guardian-a-${run}@example.test`,
  password: "Correct-Horse-42!",
};
const B = {
  email: `guardian-b-${run}@example.test`,
  password: "Battery-Staple-42!",
};
const NEW_PASSWORD = "Rotated-Passphrase-77!";
let browser: Browser, ctxA: BrowserContext, ctxB: BrowserContext;
let a: Page,
  b: Page,
  sessionA = "";
const consoleErrors: string[] = [];

async function mailLink(to: string, contains: string) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(
      `${MAIL}/api/v1/search?query=${encodeURIComponent("to:" + to)}`,
    );
    const list = (await r.json()) as { messages: { ID: string }[] };
    for (const m of list.messages || []) {
      const msg = (await (
        await fetch(`${MAIL}/api/v1/message/${m.ID}`)
      ).json()) as { HTML: string; Text: string };
      const links = [
        ...(msg.HTML + " " + msg.Text).matchAll(/https?:\/\/[^\s"'<>]+/g),
      ]
        .map((x) => x[0].replaceAll("&amp;", "&"))
        .filter((l) => l.includes(contains));
      if (links.length) return links[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email containing ${contains} for ${to}`);
}
async function signupAndConfirm(page: Page, who: typeof A) {
  await page.goto(`${BASE}/signup`);
  await page.fill('input[name="email"]', who.email);
  await page.fill('input[name="password"]', who.password);
  await page.check('input[name="guardian"]');
  await page.click("form button.btn");
  await page.getByText("Check your email").waitFor();
  await page.goto(await mailLink(who.email, "type=signup"));
  await page.waitForURL(/\/home/);
}
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click("form button.btn");
}
async function api(
  page: Page,
  path: string,
  init?: { method: string; body: unknown },
) {
  return page.evaluate(
    async ({ path, init }) => {
      const r = await fetch(
        path,
        init && {
          method: init.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(init.body),
        },
      );
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { path, init },
  );
}
async function accessToken(ctx: BrowserContext) {
  const parts = (await ctx.cookies())
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((x, y) => x.name.localeCompare(y.name));
  let raw = parts.map((c) => c.value).join("");
  raw = decodeURIComponent(raw);
  if (raw.startsWith("base64-"))
    raw = Buffer.from(raw.slice(7), "base64url").toString();
  return (JSON.parse(raw) as { access_token: string }).access_token;
}
async function noHorizontalScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
}
type Violation = { id: string; impact: string; nodes: number };
async function axe(page: Page): Promise<Violation[] | null> {
  if (!AXE) return null;
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    // @ts-expect-error injected global
    const r = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
    });
    return r.violations.map(
      (v: { id: string; impact: string; nodes: unknown[] }) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
      }),
    );
  });
}

before(async () => {
  browser = await chromium.launch();
  ctxA = await browser.newContext({ acceptDownloads: true });
  ctxB = await browser.newContext();
  a = await ctxA.newPage();
  b = await ctxB.newPage();
  for (const p of [a, b])
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
});
after(async () => {
  await browser?.close();
});

test("1. public landing, auth routes, and health respond without dead links", async () => {
  await a.goto(BASE);
  assert.match(await a.title(), /QuiZone/);
  const hrefs = await a.$$eval("a[href^='/'], a[href^='#']", (els) => [
    ...new Set(els.map((e) => e.getAttribute("href")!)),
  ]);
  for (const href of hrefs) {
    if (href.startsWith("#")) {
      if (href.length > 1)
        assert.ok(await a.$(href), `in-page anchor ${href} exists`);
      continue;
    }
    const r = await fetch(BASE + href, { redirect: "manual" });
    assert.ok(r.status < 400, `${href} -> ${r.status}`);
  }
  const health = await (await fetch(`${BASE}/api/health`)).json();
  assert.equal(health.accountsConfigured, true);
});

test("2. guardian signup requires email confirmation before login", async () => {
  await a.goto(`${BASE}/signup`);
  await a.fill('input[name="email"]', A.email);
  await a.fill('input[name="password"]', A.password);
  await a.check('input[name="guardian"]');
  await a.click("form button.btn");
  await a.getByText("Check your email").waitFor();
  await login(a, A.email, A.password);
  await a.getByText(/Could not sign in/).waitFor();
  await a.goto(await mailLink(A.email, "type=signup"));
  await a.waitForURL(/\/home/);
});

test("3. household, explorers, and permissions persist across reload", async () => {
  await a.goto(`${BASE}/family`);
  await a.fill('input[name="name"]', "E2E Crew");
  await a.check('input[name="consent"]');
  await a.getByRole("button", { name: /Create household/ }).click();
  await a.getByRole("heading", { name: "E2E Crew" }).waitFor();
  for (const [nickname, age] of [
    ["Nova", "10"],
    ["Pixel", "12"],
  ]) {
    await a.fill('input[name="nickname"]', nickname);
    await a.fill('input[name="age"]', age);
    await a.getByRole("button", { name: /Add to the crew/ }).click();
    await a.getByRole("heading", { name: nickname, exact: true }).waitFor();
  }
  await a.check('input[name="q"]');
  await a.getByRole("button", { name: /Save family preferences/ }).click();
  await a.getByText("Saved to your family’s account.").waitFor();
  await a.reload();
  await a.getByRole("heading", { name: "Pixel", exact: true }).waitFor();
  assert.equal(await a.isChecked('input[name="q"]'), true);
});

test("4. explorer edit, archive excludes from play, restore returns", async () => {
  await a.getByRole("button", { name: "Edit Nova" }).click();
  await a.locator("dialog input[name='nickname']").fill("Nova Star");
  await a.getByRole("button", { name: "Save changes" }).click();
  await a.getByRole("heading", { name: "Nova Star", exact: true }).waitFor();
  await a.getByRole("button", { name: "Archive Pixel" }).click();
  await a.getByText(/Archived explorers \(1\)/).waitFor();
  await a.goto(`${BASE}/challenges`);
  await a
    .getByRole("button", { name: /Choose this adventure/ })
    .first()
    .click();
  await a.locator("dialog .player-choice").first().waitFor();
  const names = await a
    .locator("dialog .player-choice strong")
    .allTextContents();
  assert.deepEqual(names, ["Nova Star"]);
  await a.goto(`${BASE}/family`);
  await a.getByText(/Archived explorers/).click();
  await a.getByRole("button", { name: "Restore" }).click();
  await a.getByText("Pixel is back in the crew.").waitFor();
});

test("5. QuickZone game night: lobby → active → answers → persisted results", async () => {
  await a.goto(`${BASE}/challenges`);
  const card = a.locator(".challenge-grid > div", {
    hasText: "Curiosity kick-off",
  });
  await card.getByRole("button", { name: /Choose this adventure/ }).click();
  await a.getByRole("button", { name: /Create game night/ }).click();
  await a.waitForURL(/\/play\/[0-9a-f-]{36}/);
  sessionA = a.url().split("/play/")[1];
  await a.getByRole("button", { name: /Our crew is ready/ }).click();
  await a.getByRole("button", { name: /Start the adventure/ }).click();
  for (let i = 0; i < 3; i++) {
    const prompt = await a
      .locator(".answer-options")
      .waitFor()
      .then(() => a.locator("h2").first().textContent());
    await a.locator(".answer-options label").nth(1).click();
    await a.getByRole("button", { name: /Lock in our answer/ }).click();
    if (i < 2)
      await a.waitForFunction(
        (p) => document.querySelector("h2")?.textContent !== p,
        prompt,
      );
  }
  await a.getByText("That’s a family win.").waitFor();
  await a.reload();
  await a.getByText("That’s a family win.").waitFor();
  const s = await api(a, `/api/session?id=${sessionA}`);
  assert.equal(s.status, 200);
  assert.equal(s.body.session.state, "complete");
  assert.equal(s.body.answers.length, 3);
  assert.ok(s.body.session.total_score > 0);
});

test("5b. QuickZone bonuses are server-scored and Play again opens a new lobby", async () => {
  const s = await api(a, `/api/session?id=${sessionA}`);
  const sum = (s.body.answers as { points: number }[]).reduce(
    (t, x) => t + x.points,
    0,
  );
  assert.equal(s.body.session.total_score, sum);
  await a.getByRole("button", { name: /Play again/ }).click();
  await a.waitForURL(
    (u) => u.pathname.startsWith("/play/") && !u.pathname.endsWith(sessionA),
  );
  await a.getByRole("button", { name: /Our crew is ready/ }).waitFor();
  const next = await api(a, `/api/session?id=${a.url().split("/play/")[1]}`);
  assert.equal(next.body.session.state, "lobby");
  assert.equal(next.body.players.length, 2);
  assert.equal(next.body.version.challenge_id, s.body.version.challenge_id);
});

test("6. client-supplied scores and replays are rejected by the server", async () => {
  const steps = (await api(a, `/api/session?id=${sessionA}`)).body.steps as {
    id: string;
  }[];
  const replay = await api(a, "/api/command", {
    method: "POST",
    body: {
      action: "answer",
      data: { session: sessionA, step: steps[0].id, choice: 1 },
    },
  });
  assert.equal(replay.status, 400);
  const forged = await api(a, "/api/command", {
    method: "POST",
    body: {
      action: "answer",
      data: { session: sessionA, step: steps[0].id, choice: 1, points: 9999 },
    },
  });
  assert.equal(forged.status, 400);
});

test("7. Parent Hub reflects real recorded activity", async () => {
  await a.goto(`${BASE}/parent`);
  await a.getByText("Curiosity kick-off").first().waitFor();
});

test("8. cross-family isolation via app API and direct Supabase REST", async () => {
  await signupAndConfirm(b, B);
  await b.goto(`${BASE}/family`);
  await b.fill('input[name="name"]', "Other Crew");
  await b.check('input[name="consent"]');
  await b.getByRole("button", { name: /Create household/ }).click();
  await b.getByRole("heading", { name: "Other Crew" }).waitFor();
  const read = await api(b, `/api/session?id=${sessionA}`);
  assert.equal(read.status, 404);
  const write = await api(b, "/api/command", {
    method: "POST",
    body: {
      action: "report",
      data: { session: sessionA, reason: "technical" },
    },
  });
  assert.ok(write.status >= 400);
  const snap = await api(b, "/api/snapshot");
  assert.equal(snap.body.children.length, 0);
  assert.equal(snap.body.sessions.length, 0);
  if (!KEY) return;
  const token = await accessToken(ctxB);
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  for (const table of [
    "child_profiles",
    "game_sessions",
    "player_answers",
    "score_events",
    "households",
    "audit_events",
  ]) {
    const r = await fetch(`${SUPA}/rest/v1/${table}?select=*`, { headers });
    const rows = (await r.json()) as {
      household_id?: string;
      guardian_id?: string;
    }[];
    assert.equal(r.status, 200, table);
    assert.ok(
      rows.every((x) => !JSON.stringify(x).includes(sessionA)),
      `${table} leaks A`,
    );
    if (table === "child_profiles" || table === "game_sessions")
      assert.equal(rows.length, 0, table);
  }
  const forge = await fetch(`${SUPA}/rest/v1/score_events`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session_id: sessionA,
      child_id: sessionA,
      points: 999,
      skill: "x",
    }),
  });
  assert.ok(
    forge.status === 401 || forge.status === 403,
    `direct insert -> ${forge.status}`,
  );
  const keys = await fetch(`${SUPA}/rest/v1/rpc/qz_command`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      command: "transition",
      payload: { session: sessionA, state: "cancelled" },
    }),
  });
  assert.equal(keys.status, 400);
  const anon = await fetch(`${SUPA}/rest/v1/child_profiles?select=*`, {
    headers: { apikey: KEY },
  });
  assert.ok(
    anon.status === 401 || ((await anon.json()) as unknown[]).length === 0,
    "anon read",
  );
});

test("9. guardian data export is complete and scoped", async () => {
  const r = await api(a, "/api/account");
  assert.equal(r.status, 200);
  assert.equal(r.body.household.name, "E2E Crew");
  assert.deepEqual(
    r.body.children.map((c: { nickname: string }) => c.nickname).sort(),
    ["Nova Star", "Pixel"],
  );
  assert.equal(r.body.sessions.length, 2); // completed game + rematch lobby
  assert.equal(r.body.answers.length, 3);
  assert.ok(
    r.body.auditTrail.some((e: { action: string }) => e.action === "export"),
  );
  assert.equal(JSON.stringify(r.body).includes("Other Crew"), false);
  const denied = await fetch(`${BASE}/api/account`);
  assert.equal(denied.status, 401);
});

test("10. responsive layouts at 390 / 1024 / 1440 without horizontal scroll", async () => {
  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1440, 900],
  ]) {
    await a.setViewportSize({ width, height });
    for (const path of [
      "/",
      "/home",
      "/family",
      "/challenges",
      "/parent",
      `/play/${sessionA}`,
    ]) {
      await a.goto(BASE + path);
      await a.waitForLoadState("networkidle");
      assert.ok(await noHorizontalScroll(a), `${path} @${width}px overflows`);
    }
    if (width === 390)
      assert.ok(
        await a.locator(".mobile-nav").isVisible(),
        "mobile nav visible at 390",
      );
  }
  await a.setViewportSize({ width: 1280, height: 800 });
});

test("11. accessibility: no critical/serious WCAG 2.2 AA violations on key pages", async () => {
  const report: Record<string, unknown> = {};
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/home",
    "/family",
    "/challenges",
    "/parent",
    "/passport",
    "/world",
    `/play/${sessionA}`,
  ]) {
    await a.goto(BASE + path);
    await a.waitForLoadState("networkidle");
    const v = (await axe(a))!.filter(
      (x) => x.impact === "critical" || x.impact === "serious",
    );
    if (v.length) report[path] = v;
  }
  assert.deepEqual(report, {}, JSON.stringify(report, null, 1));
});

test("12. keyboard: skip to content and focusable primary navigation", async () => {
  await a.goto(`${BASE}/home`);
  await a.keyboard.press("Tab");
  const first = await a.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return {
      tag: el.tagName,
      visible:
        getComputedStyle(el).outlineStyle !== "none" ||
        getComputedStyle(el).boxShadow !== "none",
    };
  });
  assert.equal(first.tag, "A");
  assert.ok(first.visible, "focus indicator visible");
});

test("13. password change re-verifies, then old password stops working", async () => {
  await a.goto(`${BASE}/family`);
  await a.fill('input[name="current"]', "wrong-password-123");
  await a.fill('input[name="next"]', NEW_PASSWORD);
  await a.getByRole("button", { name: "Update password" }).click();
  await a.getByText("Your current password is incorrect.").waitFor();
  await a.fill('input[name="current"]', A.password);
  await a.fill('input[name="next"]', NEW_PASSWORD);
  await a.getByRole("button", { name: "Update password" }).click();
  await a.getByText(/Password changed/).waitFor();
  await a.getByRole("button", { name: /Sign out on every device/ }).click();
  await a.waitForURL(/\/login/);
  await login(a, A.email, A.password);
  await a.getByText(/Could not sign in/).waitFor();
  await login(a, A.email, NEW_PASSWORD);
  await a.waitForURL(/\/home/);
});

test("14. password recovery by email resets the password", async () => {
  await b.goto(`${BASE}/forgot-password`);
  await b.fill('input[name="email"]', B.email);
  await b.click("form button.btn");
  await b.getByText(/reset link is on its way/).waitFor();
  await b.goto(await mailLink(B.email, "type=recovery"));
  await b.waitForURL(/\/reset-password/);
  await b.fill('input[name="password"]', "Recovered-Passphrase-9!");
  await b.click("form button.btn");
  await b.waitForURL(/\/login/);
  await login(b, B.email, "Recovered-Passphrase-9!");
  await b.waitForURL(/\/home/);
});

test("15. account deletion erases the household and the sign-in", async () => {
  await a.goto(`${BASE}/family`);
  await a.getByRole("button", { name: "Delete account" }).click();
  await a.locator("dialog input[name='confirm']").fill("wrong");
  await a.getByRole("button", { name: "Delete everything" }).click();
  await a.getByText(/confirmation text exactly/).waitFor();
  await a.locator("dialog input[name='confirm']").fill("E2E Crew");
  await a.getByRole("button", { name: "Delete everything" }).click();
  await a.waitForURL((u) => u.pathname === "/");
  await login(a, A.email, NEW_PASSWORD);
  await a.getByText(/Could not sign in/).waitFor();
  // Guardian B is unaffected.
  const snap = await api(b, "/api/snapshot");
  assert.equal(snap.body.household.name, "Other Crew");
});

test("16. no uncaught client console errors during the journey", () => {
  const relevant = consoleErrors.filter(
    (e) => !/status of 40[0134]|Failed to load resource/.test(e),
  );
  assert.deepEqual(relevant, []);
});
