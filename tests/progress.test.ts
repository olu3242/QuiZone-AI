import { test } from "node:test";
import assert from "node:assert/strict";
import { levelFor, levels } from "../lib/progress";

test("levels follow PRD §11 order and thresholds", () => {
  assert.deepEqual(
    levels.map((l) => l[0]),
    [
      "Explorer",
      "Thinker",
      "Solver",
      "Builder",
      "Strategist",
      "Innovator",
      "Leader",
      "Global Challenger",
    ],
  );
  assert.deepEqual(levelFor(0), {
    name: "Explorer",
    index: 1,
    xp: 0,
    next: "Thinker",
    toNext: 300,
    progress: 0,
  });
  assert.equal(levelFor(299).name, "Explorer");
  assert.equal(levelFor(300).name, "Thinker");
  assert.equal(levelFor(1500).name, "Builder");
  const top = levelFor(50000);
  assert.equal(top.name, "Global Challenger");
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
  assert.equal(levelFor(-5).xp, 0);
  assert.equal(levelFor(Number.NaN).name, "Explorer");
});
