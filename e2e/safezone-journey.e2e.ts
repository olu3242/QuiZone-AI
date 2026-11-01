// SafeZone guardian → child → moderator journey on a real Supabase stack.
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
  operatorSql,
  signupAndConfirm,
} from "./support";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const AXE = process.env.E2E_AXE_PATH || require.resolve("axe-core/axe.min.js");
const run = Date.now().toString(36);
const MOD = {
  email: `moderator-${run}@example.test`,
  password: "Moderator-Pass-42!",
};
const GA = {
  email: `sz-guardian-a-${run}@example.test`,
  password: "Guardian-A-Pass-42!",
};
const GB = {
  email: `sz-guardian-b-${run}@example.test`,
  password: "Guardian-B-Pass-42!",
};
const TITLE = `How can we make our schools safer? ${run}`;
let browser: Browser,
  cm: BrowserContext,
  ca: BrowserContext,
  cb: BrowserContext;
let mod: Page, a: Page, b: Page;
let hall = "",
  nova = "",
  orbit = "",
  novaHandle = "",
  orbitHandle = "";
const errors: string[] = [];

const fieldValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
async function room(page: Page, child: string | null) {
  await page.goto(`${BASE}/safezone/${hall}${child ? `?child=${child}` : ""}`);
  await page.getByText("SAFEZONE TOWN HALL").waitFor();
}

before(async () => {
  browser = await chromium.launch();
  [cm, ca, cb] = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  [mod, a, b] = await Promise.all([cm.newPage(), ca.newPage(), cb.newPage()]);
  for (const p of [mod, a, b])
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
});
after(async () => {
  await browser?.close();
});

test("1. SafeZone is closed to families until an operator enables it", async () => {
  await signupAndConfirm(a, GA);
  await createHousehold(a, `SZ Crew A ${run}`, [
    ["Nova", 11],
    ["Tiny", 8],
  ]);
  operatorSql(
    "update private.feature_flags set enabled=false where flag='safezone'",
  );
  await a.goto(`${BASE}/safezone`);
  await a.getByText(/in safety review/).waitFor();
  assert.equal(
    await a.getByRole("button", { name: "Enable SafeZone" }).count(),
    0,
  );
});

test("2. only an operator-granted moderator gets the console; moderator drafts and publishes a town hall", async () => {
  await signupAndConfirm(mod, MOD);
  await mod.goto(`${BASE}/safezone`);
  await mod.getByRole("heading", { name: "SafeZone town halls" }).waitFor();
  assert.equal(await mod.getByText("Moderator console").count(), 0);
  operatorSql(
    `insert into private.staff select id,'moderator' from auth.users where email='${MOD.email}'`,
  );
  operatorSql(
    "update private.feature_flags set enabled=true where flag='safezone'",
  );
  await mod.reload();
  await mod.getByText("Moderator console").waitFor();
  await mod.getByLabel("Title").fill(TITLE);
  await mod
    .getByLabel("Summary")
    .fill(
      "A moderated discussion for young problem-solvers about feeling safe at school.",
    );
  await mod
    .getByLabel("Starts")
    .fill(fieldValue(new Date(Date.now() + 86400000)));
  await mod.getByLabel("Seats").fill("3");
  await mod
    .getByLabel(/^Agenda/)
    .fill(
      "Welcome and safety rules (5 min)\nWhat makes students feel safe? (10 min)\nShare ideas and solutions (15 min)",
    );
  await mod
    .getByLabel(/^Statement cards/)
    .fill(
      "2: Knowing a trusted adult I can talk to helps me feel safe.\n2: Clear rules about kindness help everyone feel included.",
    );
  await mod
    .getByLabel(/^Question cards/)
    .fill("How do schools decide what safety rules to have?");
  await mod
    .getByLabel(/^Idea cards/)
    .fill(
      "3: Start a buddy system for new students.\n3: Create a quiet space at lunch time.",
    );
  await mod.getByRole("button", { name: "Save draft" }).click();
  await mod.getByText(/Draft saved/).waitFor();
  const row = mod.locator(".sz-console-row", { hasText: TITLE });
  await row.getByRole("button", { name: /Publish/ }).click();
  await mod.getByText(/Registration open\./).waitFor();
  hall = operatorSql(
    `select id from public.town_halls where title='${TITLE.replaceAll("'", "''")}'`,
  );
  assert.match(hall, /^[0-9a-f-]{36}$/);
});

test("3. guardian enables SafeZone and gives per-session consent with their password; age band enforced", async () => {
  await a.goto(`${BASE}/safezone`);
  await a.getByLabel("Guardian password").fill("not-my-password");
  await a.getByRole("button", { name: "Enable SafeZone" }).click();
  await a.getByText("Your guardian password is incorrect.").waitFor();
  await a.getByLabel("Guardian password").fill(GA.password);
  await a.getByRole("button", { name: "Enable SafeZone" }).click();
  await a.getByText(/SafeZone is on/).waitFor();
  const card = a.locator(".sz-hall", { hasText: TITLE });
  await card.getByRole("button", { name: "Approve an explorer" }).click();
  const dialog = a.locator("dialog");
  assert.equal(
    await dialog.getByRole("radio", { name: /Tiny/ }).isDisabled(),
    true,
  );
  await dialog.getByText("For ages 10–13").waitFor();
  await dialog.getByRole("button", { name: /Approve and register/ }).click(); // blocked by required consent
  assert.equal(await dialog.isVisible(), true);
  await dialog.locator('input[name="consent"]').check();
  await dialog.getByLabel("Guardian password").fill(GA.password);
  await dialog.getByRole("button", { name: /Approve and register/ }).click();
  await a.getByText(/Registered as /).waitFor();
  novaHandle = (await card.locator(".sz-reg em").first().textContent())!;
  assert.match(novaHandle, /^[A-Z][a-z]+ [A-Z][a-z]+ \d+$/);
  nova = operatorSql(
    `select c.id from public.child_profiles c join public.households h on h.id=c.household_id join auth.users u on u.id=h.guardian_id where c.nickname='Nova' and u.email='${GA.email}'`,
  );
});

test("4. second household registers; consent API without a password is refused", async () => {
  await signupAndConfirm(b, GB);
  await createHousehold(b, `SZ Crew B ${run}`, [["Orbit", 12]]);
  orbit = operatorSql(
    `select c.id from public.child_profiles c join public.households h on h.id=c.household_id join auth.users u on u.id=h.guardian_id where c.nickname='Orbit' and u.email='${GB.email}'`,
  );
  const bare = await api(b, "/api/command", {
    method: "POST",
    body: {
      action: "sz_register",
      data: { hall, child: orbit, consent: true },
    },
  });
  assert.equal(
    bare.status,
    400,
    "sz_register is not reachable without the password route",
  );
  const enableBare = await api(b, "/api/command", {
    method: "POST",
    body: { action: "sz_permission", data: { enabled: true } },
  });
  assert.equal(enableBare.status, 400);
  await b.goto(`${BASE}/safezone`);
  await b.getByLabel("Guardian password").fill(GB.password);
  await b.getByRole("button", { name: "Enable SafeZone" }).click();
  await b.getByText(/SafeZone is on/).waitFor();
  await b
    .locator(".sz-hall", { hasText: TITLE })
    .getByRole("button", { name: "Approve an explorer" })
    .click();
  await b.locator('dialog input[name="consent"]').check();
  await b.locator("dialog").getByLabel("Guardian password").fill(GB.password);
  await b
    .locator("dialog")
    .getByRole("button", { name: /Approve and register/ })
    .click();
  await b.getByText(/Registered as /).waitFor();
  orbitHandle = (await b
    .locator(".sz-hall", { hasText: TITLE })
    .locator(".sz-reg em")
    .first()
    .textContent())!;
});

test("5. cross-family isolation: room, REST, and API refuse the other household's explorer", async () => {
  assert.equal(
    (await api(b, `/api/safezone?hall=${hall}&child=${nova}`)).status,
    403,
  );
  const hijack = await api(b, "/api/command", {
    method: "POST",
    body: { action: "sz_hand", data: { hall, child: nova, raised: true } },
  });
  assert.ok(hijack.status >= 400);
  if (KEY) {
    const token = await accessToken(cb);
    const headers = { apikey: KEY, Authorization: `Bearer ${token}` };
    for (const t of [
      "town_hall_registrations",
      "town_hall_votes",
      "town_hall_contributions",
      "safezone_notifications",
    ]) {
      const r = await fetch(`${SUPA}/rest/v1/${t}?select=*`, { headers });
      assert.equal(r.status, 200, t);
      assert.equal(
        JSON.stringify(await r.json()).includes(nova),
        false,
        `${t} leaks A`,
      );
    }
    const write = await fetch(`${SUPA}/rest/v1/town_hall_votes`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.ok(
      write.status === 401 || write.status === 403,
      `direct write -> ${write.status}`,
    );
  }
});

test("6. explorers wait until the moderator opens and starts the room", async () => {
  await room(a, nova);
  await a.getByText(/hasn’t opened yet/).waitFor();
  await mod.goto(`${BASE}/safezone`);
  const row = mod.locator(".sz-console-row", { hasText: TITLE });
  await row.getByRole("button", { name: "Open the room" }).click();
  await mod.getByText(/Room open\./).waitFor();
  await a.getByText(/The room is open/).waitFor({ timeout: 10000 });
  await room(mod, null);
  await mod.getByRole("button", { name: "Start town hall" }).click();
  await a
    .getByRole("button", { name: /Raise hand/ })
    .waitFor({ timeout: 10000 });
});

test("6b. a dropped room connection shows Reconnecting… and recovers in place", async () => {
  await a.route("**/api/safezone**", (r) => r.abort("internetdisconnected"));
  await a
    .getByText(/Reconnecting… your saved place is kept/)
    .waitFor({ timeout: 10000 });
  assert.ok(
    await a.getByRole("button", { name: /Raise hand/ }).isVisible(),
    "last good view is kept",
  );
  await a.unroute("**/api/safezone**");
  await a
    .getByText(/Reconnecting…/)
    .waitFor({ state: "detached", timeout: 10000 });
  assert.ok(await a.getByRole("button", { name: /Raise hand/ }).isVisible());
});

test("7. raise hand → moderator grants the turn → statement shared → held for approval → visible to peers by session name only", async () => {
  await mod
    .locator(".sz-agenda li", { hasText: "What makes students feel safe?" })
    .getByRole("button", { name: "Go" })
    .click();
  await a.getByText("NOW · AGENDA ITEM 2").waitFor({ timeout: 10000 });
  const statement = a.getByRole("button", { name: /trusted adult/ });
  assert.equal(
    await statement.isDisabled(),
    true,
    "statement cards need a speaking turn",
  );
  await a.getByRole("button", { name: /Raise hand/ }).click();
  await a.getByText(/Hand raised/).waitFor();
  const queued = mod.locator(".sz-queue li", { hasText: novaHandle });
  await queued.waitFor({ timeout: 10000 });
  await queued.getByRole("button", { name: "Give turn" }).click();
  await a.getByText("It’s your turn to speak").waitFor({ timeout: 10000 });
  await statement.click();
  await a.getByText("Waiting for moderator").waitFor();
  await room(b, orbit);
  await b.getByText("Approved contributions will appear here.").waitFor();
  const pending = mod.locator(".sz-review", { hasText: "trusted adult" });
  await pending.waitFor({ timeout: 10000 });
  await pending.getByRole("button", { name: "Approve" }).click();
  const shared = b.locator(".sz-feed li", { hasText: "trusted adult" });
  await shared.waitFor({ timeout: 10000 });
  assert.match((await shared.textContent())!, new RegExp(novaHandle));
  assert.equal(
    (await b.content()).includes("Nova"),
    false,
    "peer page never shows the nickname",
  );
});

test("8. questions are anonymous to peers", async () => {
  await b.getByRole("button", { name: /How do schools decide/ }).click();
  await b.getByText("Waiting for moderator").waitFor();
  await mod
    .locator(".sz-review", { hasText: "How do schools decide" })
    .getByRole("button", { name: "Approve" })
    .click();
  const q = a.locator(".sz-feed li", { hasText: "How do schools decide" });
  await q.waitFor({ timeout: 10000 });
  assert.match((await q.textContent())!, /Anonymous question/);
  assert.equal((await q.textContent())!.includes(orbitHandle), false);
});

test("9. polls: one vote per explorer; results only after closing", async () => {
  await mod.getByLabel("Question").fill("Which idea should we try first?");
  await mod.getByLabel(/^Choices/).fill("Buddy system\nQuiet space");
  await mod.getByRole("button", { name: "Draft poll" }).click();
  await mod.getByRole("button", { name: "Open voting" }).click();
  const choice = a.getByRole("button", { name: /^Buddy system/ });
  await choice.waitFor({ timeout: 10000 });
  await choice.click();
  await a.getByText("Vote saved.").waitFor();
  assert.equal(
    await a.getByRole("button", { name: /^Quiet space/ }).isDisabled(),
    true,
  );
  const replay = await api(a, "/api/command", {
    method: "POST",
    body: {
      action: "sz_vote",
      data: {
        poll: operatorSql(
          `select id from public.town_hall_polls where town_hall_id='${hall}'`,
        ),
        child: nova,
        choice: 1,
      },
    },
  });
  assert.equal(replay.status, 400);
  await b.getByRole("button", { name: /^Quiet space/ }).click();
  await b.getByText("Vote saved.").waitFor();
  assert.equal(
    await a.locator(".sz-poll .sz-card small").count(),
    0,
    "per-choice results hidden while open",
  );
  await mod.getByRole("button", { name: "Close voting" }).click();
  await a
    .getByRole("button", { name: /^Buddy system.*1 votes/ })
    .waitFor({ timeout: 10000 });
});

test("10. reports reach the safeguarding queue and the decision is recorded", async () => {
  await b.getByLabel("Tell a moderator").selectOption("unsafe");
  await b.getByRole("button", { name: "Send report" }).click();
  await b.getByText(/A moderator will look at your report/).waitFor();
  await mod.goto(`${BASE}/safezone`);
  const report = mod.locator(".sz-report", { hasText: "unsafe" });
  await report.waitFor();
  await report.getByLabel("Decision").selectOption("actioned");
  await report.getByLabel(/^Note/).fill("Checked with participant; resolved");
  await report.getByRole("button", { name: "Record decision" }).click();
  await mod.getByText(/Report updated/).waitFor();
  assert.equal(
    operatorSql(
      `select string_agg(e.status,',' order by e.created_at) from public.safezone_report_events e join public.safezone_reports r on r.id=e.report_id where r.reason='unsafe' and r.town_hall_id='${hall}'`,
    ),
    "open,actioned",
  );
});

test("11. moderator removes a participant with a reason; their guardian is notified", async () => {
  await room(mod, null);
  await mod.getByLabel("Session name").selectOption(orbitHandle);
  await mod
    .getByLabel(/^Reason \(shared/)
    .fill("Please take a break and try another session");
  await mod.getByRole("button", { name: "Remove", exact: true }).click();
  await mod.getByText(/Participant removed/).waitFor();
  await room(b, orbit);
  await b.getByText("A moderator removed you from this town hall.").waitFor();
  await b.goto(`${BASE}/safezone`);
  await b.getByText(/removed from .* Reason: Please take a break/).waitFor();
});

test("12. idea support, completion, and a privacy-safe summary", async () => {
  await room(mod, null);
  await mod
    .locator(".sz-agenda li", { hasText: "Share ideas" })
    .getByRole("button", { name: "Go" })
    .click();
  await room(a, nova);
  await a
    .getByRole("button", { name: /buddy system for new students/ })
    .click();
  await a.getByText("Waiting for moderator").waitFor();
  await room(mod, null);
  await mod
    .locator(".sz-review", { hasText: "buddy system" })
    .getByRole("button", { name: "Approve" })
    .click();
  await mod.getByRole("button", { name: "Complete town hall" }).click();
  await room(a, nova);
  await a.getByText("Thank you for sharing your voice.").waitFor();
  await a
    .getByText(/Start a buddy system for new students\. — 1 supporter/)
    .waitFor();
});

test("13. responsive and accessible: lobby, room, and console at 390 / 1024 / 1280", async () => {
  const report: Record<string, unknown> = {};
  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1280, 800],
  ]) {
    for (const [page, path] of [
      [a, "/safezone"],
      [a, `/safezone/${hall}?child=${nova}`],
      [mod, "/safezone"],
      [mod, `/safezone/${hall}`],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(BASE + path);
      await page.waitForLoadState("networkidle");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${path} overflows at ${width}`,
      );
      const v = await axe(page, AXE);
      if (v.length) report[`${path}@${width}`] = v;
    }
  }
  assert.deepEqual(report, {}, JSON.stringify(report, null, 1));
});

test("13b. keyboard: every Tab stop in the moderator console is visible and focus is never lost", async () => {
  await mod.setViewportSize({ width: 1280, height: 800 });
  await mod.goto(`${BASE}/safezone`);
  await mod.getByText("Moderator console").waitFor();
  const stops: {
    tag: string;
    label: string;
    visible: boolean;
    native: boolean;
  }[] = [];
  for (let i = 0; i < 45; i++) {
    await mod.keyboard.press("Tab");
    stops.push(
      await mod.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          label: (
            el.getAttribute("aria-label") ||
            el.textContent ||
            (el as HTMLInputElement).name ||
            ""
          )
            .trim()
            .slice(0, 40),
          visible: cs.outlineStyle !== "none" || cs.boxShadow !== "none",
          // Focus inside a native control's UA shadow DOM (e.g. Chromium's date
          // picker button) leaves activeElement on the host without :focus; that
          // ring is drawn by the browser and cannot be measured from the page.
          native: el.tagName !== "BODY" && !el.matches(":focus"),
        };
      }),
    );
  }
  // <body> may appear only where Tab wraps past the end of the page, and the next
  // stop must be the skip link again: that is document wrap, not lost focus.
  const trace = stops.map((st, i) => `${i}:${st.tag}:${st.label}`).join(" | ");
  assert.equal(
    stops[0].label,
    "Skip to content",
    "skip link is the first stop",
  );
  assert.ok(
    stops.every(
      (st, i) =>
        st.tag !== "BODY" ||
        (i > 0 && stops[i + 1]?.label === "Skip to content"),
    ),
    "focus was lost mid-page: " + trace,
  );
  const hidden = stops.filter(
    (st) => st.tag !== "BODY" && !st.native && !st.visible,
  );
  assert.ok(
    stops.filter((st) => st.native).length <= 1,
    "only the date picker button is a UA-internal stop",
  );
  assert.deepEqual(hidden, [], "focus indicator missing");
  assert.ok(
    new Set(stops.map((st) => st.tag + st.label)).size > 15,
    "focus advances (no trap)",
  );
  // Form controls are reachable and operable by keyboard.
  assert.ok(stops.some((st) => st.tag === "INPUT"));
  assert.ok(stops.some((st) => st.tag === "SELECT"));
});

test("14. withdrawing consent removes the explorer's contributions from the record", async () => {
  await a.goto(`${BASE}/safezone`);
  await a.setViewportSize({ width: 1280, height: 800 });
  const row = a.locator(".sz-console-row", { hasText: TITLE });
  await row.getByRole("button", { name: /Withdraw & erase/ }).click();
  await a
    .getByText(/Consent withdrawn/)
    .first()
    .waitFor();
  assert.equal(
    operatorSql(
      `select count(*) from public.town_hall_contributions where child_id='${nova}' and status<>'withdrawn'`,
    ),
    "0",
  );
  assert.equal(
    operatorSql(
      `select count(*) from public.town_hall_votes where child_id='${nova}'`,
    ),
    "0",
  );
});

test("15. no uncaught client console errors", () => {
  const relevant = errors.filter(
    (e) => !/status of 40[0134]|Failed to load resource/.test(e),
  );
  assert.deepEqual(relevant, []);
});
