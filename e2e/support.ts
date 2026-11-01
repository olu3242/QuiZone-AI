// Shared helpers for browser E2E suites. Synthetic accounts only.
import { execFileSync } from "node:child_process";
import type { BrowserContext, Page } from "playwright";

export const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
export const MAIL = process.env.E2E_MAILPIT_URL || "http://127.0.0.1:54324";
export const SUPA = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
export const KEY = process.env.E2E_SUPABASE_KEY || "";
export const DB =
  process.env.E2E_DB_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Operator-only actions (staff grants, feature flags) run as SQL, exactly as an
// operator would — never through the app.
export function operatorSql(sql: string) {
  return execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-Atc", sql], {
    encoding: "utf8",
  }).trim();
}

export async function mailLink(to: string, contains: string) {
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
        ...(msg.HTML + " " + msg.Text).matchAll(/https?:\/\/[^\s"'<>)]+/g),
      ]
        .map((x) => x[0].replaceAll("&amp;", "&"))
        .filter((l) => l.includes(contains));
      if (links.length) return links[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email containing ${contains} for ${to}`);
}

export async function signupAndConfirm(
  page: Page,
  who: { email: string; password: string },
) {
  await page.goto(`${BASE}/signup`);
  await page.fill('input[name="email"]', who.email);
  await page.fill('input[name="password"]', who.password);
  await page.check('input[name="guardian"]');
  await page.click("form button.btn");
  await page.getByText("Check your email").waitFor();
  await page.goto(await mailLink(who.email, "type=signup"));
  await page.waitForURL(/\/home/);
}

export async function createHousehold(
  page: Page,
  name: string,
  explorers: [string, number][],
) {
  await page.goto(`${BASE}/family`);
  await page.fill('input[name="name"]', name);
  await page.check('input[name="consent"]');
  await page.getByRole("button", { name: /Create household/ }).click();
  await page.getByRole("heading", { name }).waitFor();
  for (const [nickname, age] of explorers) {
    await page.fill('input[name="nickname"]', nickname);
    await page.fill('input[name="age"]', String(age));
    await page.getByRole("button", { name: /Add to the crew/ }).click();
    await page.getByRole("heading", { name: nickname, exact: true }).waitFor();
  }
}

export async function api(
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

export async function accessToken(ctx: BrowserContext) {
  const parts = (await ctx.cookies())
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((x, y) => x.name.localeCompare(y.name));
  let raw = decodeURIComponent(parts.map((c) => c.value).join(""));
  if (raw.startsWith("base64-"))
    raw = Buffer.from(raw.slice(7), "base64url").toString();
  return (JSON.parse(raw) as { access_token: string }).access_token;
}

export type Violation = {
  id: string;
  impact: string;
  nodes: number;
  targets: string[];
};
export async function axe(page: Page, path: string): Promise<Violation[]> {
  await page.addScriptTag({ path });
  return page.evaluate(async () => {
    // @ts-expect-error injected global
    const r = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
    });
    return r.violations
      .filter((v: { impact: string }) =>
        ["serious", "critical"].includes(v.impact),
      )
      .map(
        (v: {
          id: string;
          impact: string;
          nodes: { target: string[]; any: { message: string }[] }[];
        }) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          targets: v.nodes
            .slice(0, 6)
            .map(
              (n) =>
                n.target.join(" ") +
                " :: " +
                (n.any[0]?.message || "").slice(0, 110),
            ),
        }),
      );
  });
}
