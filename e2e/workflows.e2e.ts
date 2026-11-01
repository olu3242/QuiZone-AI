// QZ-39: Workflow OS on a real app + Supabase stack (pg_cron included).
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
  email: `wf-${run}@example.test`,
  password: "Workflow-Guardian-42!",
};
const ADM = {
  email: `wf-admin-${run}@example.test`,
  password: "Workflow-Admin-42!",
};
let browser: Browser, g: Page, adm: Page;
const kids: Record<string, string> = {};
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
// One explorer plays QuickZone to the end (each new explorer earns new badges).
async function playWith(name: string) {
  const r = await api(g, "/api/command", {
    method: "POST",
    body: {
      action: "create",
      data: {
        challenge: operatorSql(
          "select id from public.challenges where title='Curiosity kick-off'",
        ),
        children: [kids[name]],
      },
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await g.goto(`${BASE}/play/${(r.body as { session: string }).session}`);
  await g.getByRole("button", { name: /Our crew is ready/ }).click();
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  for (let i = 0; i < 12; i++) {
    const win = g.getByText("That’s a family win.");
    await g.locator(".answer-options label").first().or(win).waitFor();
    if (await win.isVisible()) return;
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
}
const consoleCard = () => adm.locator(".workflows-console");
async function openConsole() {
  await adm.goto(`${BASE}/admin`);
  await consoleCard()
    .getByRole("heading", { name: /Workflows/ })
    .waitFor();
}

before(async () => {
  browser = await chromium.launch();
  const pages: Page[] = [];
  for (let i = 0; i < 2; i++) {
    const p = await (await browser.newContext()).newPage();
    p.on("console", (m) => {
      if (m.type() === "error" && !/status of 4\d\d/.test(m.text()))
        errors.push(m.text());
    });
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
  }
  [g, adm] = pages;
  await signupAndConfirm(g, G);
  await createHousehold(g, `Flow Crew ${run}`, [
    ["Lark", 10],
    ["Moss", 11],
  ]);
  for (const kv of operatorSql(
    `select string_agg(c.nickname||'='||c.id, ',') from public.child_profiles c join public.households h on h.id=c.household_id join auth.users u on u.id=h.guardian_id where u.email='${G.email}'`,
  ).split(",")) {
    const [n, id] = kv.split("=");
    kids[n] = id;
  }
  await signupAndConfirm(adm, ADM);
  operatorSql(
    `insert into private.staff select id,'admin' from auth.users where email='${ADM.email}'`,
  );
});
after(async () => {
  // Never leave a workflow paused for later suites.
  operatorSql(
    "update private.wf_definitions set enabled=true where not enabled",
  );
  operatorSql(
    `delete from private.staff where user_id in (select id from auth.users where email='${ADM.email}')`,
  );
  await browser?.close();
});

test("W1. the console lists every workflow with its live version, trigger, and steps", async () => {
  await openConsole();
  for (const key of [
    "badge.notify",
    "member.joined.notify",
    "member.left.notify",
    "report.status.notify",
    "consent.notify",
    "game.member_hosted.notify",
    "ops.maintenance",
  ])
    await consoleCard()
      .locator(".wf-definitions li", { hasText: key })
      .waitFor();
  await consoleCard()
    .getByText("on badge.awarded → notify_badge")
    .first()
    .waitFor();
  await scan(adm, "admin-workflows");
});

test("W2. a completed game runs the badge workflow end to end, with a step log", async () => {
  await playWith("Lark");
  await g.goto(`${BASE}/parent`);
  await g
    .locator(".family-inbox")
    .getByText(/Lark earned/)
    .first()
    .waitFor();
  await openConsole();
  const runRow = consoleCard()
    .locator(".wf-runs li", { hasText: "badge.notify" })
    .first();
  await runRow.locator(".wf-status.succeeded").waitFor();
  await runRow.locator("summary").click();
  await runRow.getByText(/notify_badge \(attempt 1\): succeeded/).waitFor();
});

test("W3. pausing a workflow queues its runs; resuming and ticking delivers them", async () => {
  await openConsole();
  await consoleCard()
    .getByRole("button", { name: "Pause badge.notify" })
    .click();
  await consoleCard().getByText("badge.notify paused.").waitFor();
  await playWith("Moss");
  await g.goto(`${BASE}/parent`);
  await g
    .locator(".family-inbox")
    .getByRole("heading", { name: /Family inbox/ })
    .waitFor();
  assert.equal(
    await g
      .locator(".family-inbox")
      .getByText(/Moss earned/)
      .count(),
    0,
  );
  await openConsole();
  await consoleCard()
    .locator(".wf-runs li", { hasText: "badge.notify" })
    .getByText("Paused")
    .first()
    .waitFor();
  await consoleCard()
    .getByRole("button", { name: "Resume badge.notify" })
    .click();
  await consoleCard().getByText("badge.notify resumed.").waitFor();
  await consoleCard()
    .getByRole("button", { name: /Run tick now/ })
    .click();
  await consoleCard()
    .getByText(/Tick ran: [1-9]\d* succeeded/)
    .waitFor();
  await g.reload();
  await g
    .locator(".family-inbox")
    .getByText(/Moss earned/)
    .first()
    .waitFor();
});

test("W4. a dead-letter run can be retried from the console", async () => {
  const id = operatorSql(
    "with u as (update private.wf_runs set status='dead', attempt=5, last_error='Injected outage for the test' where id=(select max(id) from private.wf_runs where workflow_key='badge.notify') returning id) select id from u",
  );
  await openConsole();
  const dead = Number(
    await consoleCard().locator(".wf-stats dd").first().textContent(),
  );
  assert.ok(dead >= 1);
  await consoleCard()
    .getByRole("button", { name: `Retry run ${id}` })
    .click();
  await consoleCard().getByText(`Run ${id} queued for retry.`).waitFor();
  await consoleCard()
    .getByRole("button", { name: /Run tick now/ })
    .click();
  await consoleCard()
    .getByText(/Tick ran:/)
    .waitFor();
  assert.equal(
    operatorSql(`select status from private.wf_runs where id=${id}`),
    "succeeded",
  );
  await scan(adm, "admin-workflows-after-retry");
});

test("W5. guardians can't see or steer workflows", async () => {
  assert.equal((await api(g, "/api/workflows")).status, 403);
  const r = await api(g, "/api/command", {
    method: "POST",
    body: { action: "wf_tick", data: {} },
  });
  assert.ok(r.status >= 400);
  assert.match(String(r.body?.error), /administrator/i);
});

test("W6. pg_cron runs the runtime every minute on the real stack", async () => {
  assert.equal(
    operatorSql("select count(*) from cron.job where jobname='qz-workflows'"),
    "1",
  );
  assert.equal(
    operatorSql("select count(*) from cron.job where jobname='qz-maintenance'"),
    "0",
  );
  const since = operatorSql("select now()");
  let ok = "0";
  for (let i = 0; i < 40 && ok === "0"; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    ok = operatorSql(
      `select count(*) from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='qz-workflows' and d.status='succeeded' and d.start_time>'${since}'`,
    );
  }
  assert.notEqual(ok, "0", "no successful scheduled tick within two minutes");
});

test("W7. accessibility (axe WCAG 2.2 AA) and no overflow", () => {
  assert.deepEqual(a11y, {});
});

test("W8. no uncaught client console errors", () => {
  assert.deepEqual(errors, []);
});
