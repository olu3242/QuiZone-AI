import { test } from "node:test";
import assert from "node:assert/strict";
import { actionSchema, childSchema, safeNext } from "../lib/validation";
test("redirect targets stay on the local origin", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test"])
    assert.equal(safeNext(value), "/home");
  assert.equal(safeNext("/passport"), "/passport");
});
test("child validation rejects contact-like nicknames and unsupported ages", () => {
  assert.equal(
    childSchema.safeParse({
      nickname: "kid@example.com",
      age: 10,
      avatar: "fox",
      interest: "science",
    }).success,
    false,
  );
  assert.equal(
    childSchema.safeParse({
      nickname: "Fox",
      age: 7,
      avatar: "fox",
      interest: "science",
    }).success,
    false,
  );
});
test("score is never accepted as part of answer payload", () => {
  const parsed = actionSchema.parse({
    action: "answer",
    data: {
      session: "11111111-1111-4111-8111-111111111111",
      step: "22222222-2222-4222-8222-222222222222",
      choice: 0,
      score: 999999,
    },
  });
  assert.equal("score" in parsed.data, false);
});
test("household requires explicit guardian consent", () => {
  assert.equal(
    actionSchema.safeParse({
      action: "household",
      data: { name: "Crew", consent: false },
    }).success,
    false,
  );
});
test("invalid mode, transitions, and report reason fail validation", () => {
  for (const payload of [
    { action: "transition", data: { session: "x", state: "complete" } },
    {
      action: "report",
      data: {
        session: "11111111-1111-4111-8111-111111111111",
        reason: "free text",
      },
    },
    { action: "create", data: { challenge: "x", children: [] } },
  ])
    assert.equal(actionSchema.safeParse(payload).success, false);
});
test("allocation validator rejects overspending, missing categories, and negative amounts", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  for (const allocation of [
    { solar: 100001, wind: 0, battery: 0, diesel: 0, grid: 0, efficiency: 0 },
    { solar: -1, wind: 0, battery: 0, diesel: 0, grid: 0, efficiency: 0 },
    { solar: 10000 },
  ])
    assert.equal(
      actionSchema.safeParse({
        action: "plan",
        data: { session: id, step: id, allocation },
      }).success,
      false,
    );
});
