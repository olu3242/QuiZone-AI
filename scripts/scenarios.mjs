// Renders e2e/scenarios.json as docs/QUIZONE_SCENARIOS.md (run: node scripts/scenarios.mjs).
import { readFileSync, writeFileSync } from "node:fs";
const { scenarios } = JSON.parse(readFileSync("e2e/scenarios.json", "utf8"));
const esc = (s) => s.replace(/\|/g, "\\|");
const roles = [...new Set(scenarios.map((s) => s.role))];
let md = `# QuiZone AI — scenario catalog

Generated from \`e2e/scenarios.json\` by \`node scripts/scenarios.mjs\`. \`tests/scenarios.test.ts\` fails if a scenario cites a test that doesn't exist, or if any browser test or DB test file isn't mapped here.

**${scenarios.length} scenarios** · ${scenarios.filter((s) => s.browser.length).length} with browser evidence · ${scenarios.filter((s) => !s.browser.length).length} DB-only (with a stated reason).
`;
for (const r of roles) {
  md += `\n## ${r[0].toUpperCase() + r.slice(1)}\n\n| ID | Scenario | Browser evidence | DB / unit evidence |\n| --- | --- | --- | --- |\n`;
  for (const s of scenarios.filter((x) => x.role === r))
    md += `| ${s.id} | ${esc(s.scenario)} | ${s.browser.map((b) => "`" + b.split("#")[0] + "`").join(", ") || "—"} | ${s.db.map((d) => "`" + d + "`").join(", ") || "—"} |\n`;
}
writeFileSync("docs/QUIZONE_SCENARIOS.md", md);
console.log(`wrote ${scenarios.length} scenarios`);
