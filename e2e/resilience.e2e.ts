// Fault injection + QZ-04 hardening on a real Supabase stack.
// Network faults are injected in the browser with Playwright routing; the
// server and database are real, so persistence claims are checked server-side.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { Browser, Page } from "playwright";
import {
  BASE,
  api,
  createHousehold,
  operatorSql,
  signupAndConfirm,
} from "./support";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const run = Date.now().toString(36);
const G = {
  email: `resilience-${run}@example.test`,
  password: "Resilient-Pass-42!",
};
let browser: Browser,
  page: Page,
  session = "";
type Saved = {
  session: { total_score: number; state: string };
  answers: { step_id: string; points: number }[];
  steps: { id: string }[];
};
const saved = async () =>
  (await api(page, `/api/session?id=${session}`)).body as Saved;

before(async () => {
  browser = await chromium.launch();
  page = await (await browser.newContext()).newPage();
  await signupAndConfirm(page, G);
  await createHousehold(page, `Resilience Crew ${run}`, [["Bolt", 10]]);
});
after(async () => {
  await browser?.close();
});

test("1. reset-password refuses an ordinary signed-in session (recovery link required)", async () => {
  const r = await api(page, "/api/auth", {
    method: "POST",
    body: { mode: "reset-password", password: "Hijacked-Password-1!" },
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /fresh password reset link/);
  // The password really is unchanged: the original still signs in.
  const again = await api(page, "/api/auth", {
    method: "POST",
    body: { mode: "login", email: G.email, password: G.password },
  });
  assert.equal(again.status, 200);
});

test("2. dropped polls show a reconnect state and recover without losing the session", async () => {
  await page.goto(`${BASE}/challenges`);
  await page
    .locator(".challenge-grid > div", { hasText: "Curiosity kick-off" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await page.getByRole("button", { name: /Create game night/ }).click();
  await page.waitForURL(/\/play\/[0-9a-f-]{36}/);
  session = page.url().split("/play/")[1];
  await page.getByRole("button", { name: /Our crew is ready/ }).click();
  await page.getByRole("button", { name: /Start the adventure/ }).click();
  await page.locator(".answer-options").waitFor();
  await page.route("**/api/session**", (r) => r.abort("internetdisconnected"));
  await page
    .getByRole("button", { name: "Reconnect" })
    .waitFor({ timeout: 12000 });
  await page.unroute("**/api/session**");
  await page.getByRole("button", { name: "Reconnect" }).click();
  await page
    .getByRole("button", { name: "Reconnect" })
    .waitFor({ state: "detached", timeout: 8000 });
  assert.equal((await saved()).session.state, "active");
});

test("3. a failed write (503) is surfaced, nothing is saved, and retry succeeds exactly once", async () => {
  await page.route(
    "**/api/command",
    (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Service temporarily unavailable." }),
      }),
    { times: 1 },
  );
  await page.locator(".answer-options label").first().click();
  await page.getByRole("button", { name: /Lock in our answer/ }).click();
  await page.getByText("Service temporarily unavailable.").waitFor();
  assert.equal(
    (await saved()).answers.length,
    0,
    "the injected failure never reached the server",
  );
  await page.getByRole("button", { name: /Lock in our answer/ }).click();
  await page.waitForFunction(
    () =>
      !document.body.textContent?.includes("Service temporarily unavailable."),
  );
  await page.locator(".answer-history, .answer-options").first().waitFor();
  const s = await saved();
  assert.equal(s.answers.length, 1);
});

test("4. a lost response after the server saved is safe to retry: no duplicate answer or double score", async () => {
  const before = await saved();
  const step = before.steps.find(
    (st) => !before.answers.some((a) => a.step_id === st.id),
  )!;
  // Let the request reach the server, then drop the response on the floor.
  await page.route(
    "**/api/command",
    async (r) => {
      await r.fetch();
      await r.abort("connectionreset");
    },
    { times: 1 },
  );
  const first = await page.evaluate(
    async (body) => {
      try {
        await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return "delivered";
      } catch {
        return "lost";
      }
    },
    { action: "answer", data: { session, step: step.id, choice: 0 } },
  );
  assert.equal(first, "lost");
  const afterLost = await saved();
  assert.equal(
    afterLost.answers.length,
    before.answers.length + 1,
    "the server did save it",
  );
  const retry = await api(page, "/api/command", {
    method: "POST",
    body: { action: "answer", data: { session, step: step.id, choice: 0 } },
  });
  assert.equal(retry.status, 400);
  assert.equal(retry.body.code, "rejected");
  const final = await saved();
  assert.equal(
    final.answers.length,
    afterLost.answers.length,
    "retry did not duplicate",
  );
  assert.equal(
    final.session.total_score,
    final.answers.reduce((t, a) => t + a.points, 0),
    "score equals saved answers",
  );
});

test("5. database internals are not leaked in API errors", async () => {
  const r = await api(page, "/api/command", {
    method: "POST",
    body: {
      action: "transition",
      data: { session: "00000000-0000-4000-8000-000000000000", state: "ready" },
    },
  });
  assert.ok(r.status >= 400);
  assert.doesNotMatch(
    JSON.stringify(r.body),
    /constraint|syntax|relation|uuid|SQLSTATE/i,
  );
});

test("6. password re-verification is rate limited (10 per 15 minutes)", async () => {
  operatorSql(
    `delete from private.rate_events where uid=(select id from auth.users where email='${G.email}')`,
  );
  const attempt = () =>
    api(page, "/api/account", {
      method: "POST",
      body: {
        action: "change-password",
        current: "definitely-wrong",
        next: "Another-Passphrase-1!",
      },
    });
  for (let i = 0; i < 10; i++) assert.equal((await attempt()).status, 400);
  const blocked = await attempt();
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Too many attempts/);
});

test("7. draft challenge titles are hidden from guardians end-to-end", async () => {
  operatorSql(
    "insert into public.challenges(title,mode,description) values('Unreleased secret quiz','quick','Draft-only content that must stay hidden.')",
  );
  const snap = await api(page, "/api/snapshot");
  assert.equal(
    JSON.stringify(snap.body).includes("Unreleased secret quiz"),
    false,
  );
});
