import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// QZ-38: the scenario catalog (e2e/scenarios.json) is the traceability map from user
// scenarios to automated evidence. This keeps it honest in both directions.
type Scenario = {
  id: string;
  role: string;
  scenario: string;
  browser: string[];
  db: string[];
  dbOnlyReason?: string;
};
const { scenarios } = JSON.parse(
  readFileSync("e2e/scenarios.json", "utf8"),
) as { scenarios: Scenario[] };
const titlesIn = (file: string) =>
  [
    ...readFileSync(file, "utf8").matchAll(/^test\(\s*"((?:[^"\\]|\\.)*)"/gm),
  ].map((m) => m[1].replace(/\\"/g, '"'));
const e2eFiles = readdirSync("e2e").filter((f) => f.endsWith(".e2e.ts"));
const dbFiles = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));

test("scenario ids are unique and every scenario has evidence", () => {
  const ids = scenarios.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of scenarios) {
    assert.ok(s.scenario.length > 5, s.id);
    assert.ok(s.browser.length + s.db.length > 0, `${s.id} has no evidence`);
    if (!s.browser.length)
      assert.ok(s.dbOnlyReason, `${s.id} is DB-only without a reason`);
  }
});

test("every cited browser test and DB test file exists", () => {
  for (const s of scenarios) {
    for (const ref of s.browser) {
      const [file, title] = ref.split("#");
      assert.ok(existsSync(file), `${s.id}: missing ${file}`);
      assert.ok(
        titlesIn(file).includes(title),
        `${s.id}: no test "${title}" in ${file}`,
      );
    }
    for (const file of s.db) {
      assert.ok(existsSync(file), `${s.id}: missing ${file}`);
      assert.ok(titlesIn(file).length > 0, `${s.id}: ${file} has no tests`);
    }
  }
});

test("every browser test and every DB test file is mapped to a scenario", () => {
  const cited = new Set(scenarios.flatMap((s) => s.browser));
  for (const f of e2eFiles)
    for (const t of titlesIn(`e2e/${f}`))
      assert.ok(
        cited.has(`e2e/${f}#${t}`),
        `uncatalogued browser test: ${f} → ${t}`,
      );
  const citedDb = new Set(scenarios.flatMap((s) => s.db));
  for (const f of dbFiles)
    assert.ok(citedDb.has(`tests/${f}`), `uncatalogued DB test file: ${f}`);
});
