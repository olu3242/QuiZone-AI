import { test } from "node:test";
import assert from "node:assert/strict";
import { publicError } from "../lib/errors";

test("deliberate refusals and rate limits pass through with stable codes", () => {
  assert.deepEqual(
    publicError({ code: "P0001", message: "This town hall is full" }, "t"),
    {
      status: 400,
      error: "This town hall is full",
      code: "rejected",
    },
  );
  assert.deepEqual(
    publicError({ code: "QZ429", message: "Too many attempts." }, "t"),
    {
      status: 429,
      error: "Too many attempts.",
      code: "rate_limited",
    },
  );
  assert.equal(
    publicError(
      { code: "42501", message: "permission denied for table x" },
      "t",
    ).status,
    403,
  );
  assert.equal(
    publicError({ code: "28000", message: "Please sign in" }, "t").status,
    401,
  );
});

test("database internals never reach the client", () => {
  const warn = console.warn;
  const logged: string[] = [];
  console.warn = (m: string) => logged.push(m);
  try {
    for (const raw of [
      { code: "22P02", message: 'invalid input syntax for type uuid: "x"' },
      {
        code: "23514",
        message: 'new row violates check constraint "child_profiles_age_check"',
      },
      {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "households_guardian_id_key"',
      },
      null,
    ]) {
      const e = publicError(raw, "unit");
      assert.equal(e.code, "invalid");
      assert.doesNotMatch(e.error, /uuid|constraint|duplicate|households/);
    }
    assert.equal(
      logged.length,
      4,
      "unexpected errors are logged for operators",
    );
    assert.match(logged[0], /"context":"unit"/);
  } finally {
    console.warn = warn;
  }
});
