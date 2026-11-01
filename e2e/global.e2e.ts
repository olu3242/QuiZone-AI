// QZ-33: Global Connect on a real app + Supabase stack. Five synthetic households are
// seeded by the operator through the same command boundary the app uses (qz_command),
// then a real guardian plays WorldZone in the browser and sees only aggregates.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  email: `global-${run}@example.test`,
  password: "Global-Guardian-42!",
};
const seeded = Array.from({ length: 5 }, () => randomUUID());
let browser: Browser,
  g: Page,
  session = "";
const a11y: Record<string, unknown> = {};
const errors: string[] = [];

const as = (uid: string, sql: string) =>
  `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); ${sql}`;

// A synthetic household that plays WorldZone once, every step answered with `choice`.
function seed(uid: string, i: number, choice: number) {
  operatorSql(
    `insert into auth.users(id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
     values('${uid}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'global-seed-${i}-${run}@example.test', now(), now(), now())`,
  );
  operatorSql(
    as(
      uid,
      `do $$
      declare s uuid; st record; kid uuid;
      begin
        perform public.qz_command('household', jsonb_build_object('name','Seed Globe ${i} ${run}','consent',true));
        perform public.qz_command('permissions', '{"world":true,"q":false,"minutes":60}'::jsonb);
        perform public.qz_command('child', '{"nickname":"Seedling${i}","age":11,"avatar":"owl","interest":"world"}'::jsonb);
        select c.id into kid from public.child_profiles c join public.households h on h.id=c.household_id where h.guardian_id='${uid}';
        s := (public.qz_command('create', jsonb_build_object('challenge',(select id from public.challenges where mode='world' and title='Water-wise cities'),'children',jsonb_build_array(kid)))->>'session')::uuid;
        perform public.qz_command('transition', jsonb_build_object('session',s,'state','ready'));
        perform public.qz_command('transition', jsonb_build_object('session',s,'state','active'));
        for st in select cs.id from public.challenge_steps cs join public.game_sessions g on g.challenge_version_id=cs.version_id where g.id=s order by cs.ordinal loop
          perform public.qz_command('answer', jsonb_build_object('session',s,'step',st.id,'choice',${choice}));
        end loop;
      end$$;`,
    ),
  );
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
  await page.setViewportSize({ width: 1280, height: 844 });
}

before(async () => {
  seeded.forEach((uid, i) => seed(uid, i, i % 2));
  browser = await chromium.launch();
  g = await (await browser.newContext()).newPage();
  g.on("console", (m) => {
    // G2 requests another household's session on purpose; that 404 is expected.
    if (m.type() === "error" && !/status of 4\d\d/.test(m.text()))
      errors.push(m.text());
  });
  g.on("pageerror", (e) => errors.push(e.message));
  await signupAndConfirm(g, G);
  await createHousehold(g, `Compass Crew ${run}`, [["Orbit", 11]]);
  await g.goto(`${BASE}/family`);
  await g.check('input[name="world"]');
  await g.getByRole("button", { name: /Save family preferences/ }).click();
  await g.getByText("Saved to your family’s account.").waitFor();
});
after(async () => {
  // Remove the synthetic households through the normal deletion path.
  for (const uid of seeded)
    operatorSql(
      as(
        uid,
        `select public.qz_command('account_delete', jsonb_build_object('confirm',(select name from public.households where guardian_id='${uid}')));`,
      ),
    );
  await browser?.close();
});

test("G1. after WorldZone, the family sees aggregate answers from other families", async () => {
  await g.goto(`${BASE}/challenges`);
  await g
    .locator(".challenge-grid > div", { hasText: "Water-wise cities" })
    .getByRole("button", { name: /Choose this adventure/ })
    .click();
  await g.getByRole("button", { name: /Create game night/ }).click();
  await g.waitForURL(/\/play\/[0-9a-f-]{36}/);
  session = g.url().split("/play/")[1];
  await g.getByRole("button", { name: /Our crew is ready/ }).click();
  await g.getByRole("button", { name: /Start the adventure/ }).click();
  for (let i = 0; i < 6; i++) {
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
  const card = g.locator(".global-compare");
  await card
    .getByRole("heading", { name: /How families around QuiZone answered/ })
    .waitFor();
  await card.locator(".compare-step li").first().waitFor();
  await card.getByText("· your pick").first().waitFor();
  assert.ok(
    (await card.locator('[role="img"][aria-label$="% of families"]').count()) >=
      2,
  );
  await scan(g, "global-compare");
});

test("G2. nothing identifies another family, on the page or in the API", async () => {
  const page = await g.content();
  assert.ok(!/Seed Globe|Seedling/.test(page));
  const r = await api(g, `/api/compare?session=${session}`);
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.body);
  for (const uid of seeded) assert.ok(!text.includes(uid));
  assert.ok(!/Seed Globe|Seedling|household|child_id|session_id/.test(text));
  // Another household's session can't be compared from here.
  const other = operatorSql(
    `select g.id from public.game_sessions g join public.households h on h.id=g.household_id where h.guardian_id='${seeded[0]}' limit 1`,
  );
  assert.equal((await api(g, `/api/compare?session=${other}`)).status, 404);
});

test("G3. the operator kill switch hides comparisons", async () => {
  operatorSql(
    "update private.feature_flags set enabled=false where flag='global_compare'",
  );
  try {
    await g.reload();
    await g.getByText("That’s a family win.").waitFor();
    await g.waitForTimeout(1500);
    assert.equal(await g.locator(".global-compare").count(), 0);
  } finally {
    operatorSql(
      "update private.feature_flags set enabled=true where flag='global_compare'",
    );
  }
});

test("G4. accessibility (axe WCAG 2.2 AA) and no overflow", () => {
  assert.deepEqual(a11y, {});
});

test("G5. no uncaught client console errors", () => {
  assert.deepEqual(errors, []);
});
