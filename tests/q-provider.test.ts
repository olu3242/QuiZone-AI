import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { screenHint } from "../lib/q-screen";
import { suggestHint } from "../lib/q-adapter";
import { harness } from "./support/db";

// QZ-34: the Q provider boundary, against a local stand-in for the Messages API
// (no key, no network, no spend) plus the database's flag, budget, and audit.
let server: Server,
  base = "";
let lastBody: Record<string, unknown> = {};
let reply: { status: number; body: unknown } = { status: 200, body: {} };
const message = (text: string, stop = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text }],
  stop_reason: stop,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});
const input = {
  title: "Plant power",
  prompt: "Which action helps a plant make its own food?",
  options: ["Putting it in a dark cupboard", "Giving it sunlight"],
  minAge: 8,
  maxAge: 12,
};
const client = () =>
  new Anthropic({ apiKey: "test-key", baseURL: base, maxRetries: 0 });

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw || "{}");
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));

test("screening rejects links, contact details, answer reveals, chat, and unsafe text", () => {
  assert.equal(
    screenHint("“Think about what leaves need from the sky to grow.”"),
    "Think about what leaves need from the sky to grow.",
  );
  for (const bad of [
    "short",
    "x".repeat(301),
    "Look it up at https://example.com for the answer to this.",
    "Email me at kid@example.com and I will help you.",
    "Call 555 123 4567 and we can work it out together.",
    "Tell me your school and I'll give a better clue.",
    "The correct answer is the second option, well done!",
    "Think about <b>light</b> and what a leaf can do.",
  ])
    assert.equal(screenHint(bad), null, bad);
  assert.equal(
    screenHint("Is giving it sunlight something plants enjoy?", input.options),
    null,
  );
});

test("the request carries content only, with the model, low effort, and fallbacks", async () => {
  reply = {
    status: 200,
    body: message("What do leaves soak up on a bright day?"),
  };
  const r = await suggestHint(input, client());
  assert.deepEqual(r, {
    ok: true,
    hint: "What do leaves soak up on a bright day?",
    model: "claude-opus-5-5",
  });
  assert.equal(lastBody.model, "claude-opus-5-5");
  assert.equal(lastBody.fallbacks, "default");
  assert.deepEqual(lastBody.output_config, { effort: "low" });
  assert.equal("thinking" in lastBody, false);
  assert.match(String(lastBody.system), /never say which option is correct/);
  const sent = JSON.stringify(lastBody.messages);
  assert.match(sent, /Plant power/);
  assert.ok(!/nickname|household|guardian|@/.test(sent));
});

test("unsafe, refused, truncated, rate-limited, and failed calls never yield a hint", async () => {
  reply = { status: 200, body: message("The right answer is sunlight!") };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "screened",
  });
  reply = { status: 200, body: message("UNSUITABLE") };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "refused",
  });
  reply = { status: 200, body: message("", "refusal") };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "refused",
  });
  reply = { status: 200, body: message("What do leaves", "max_tokens") };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "screened",
  });
  reply = {
    status: 429,
    body: {
      type: "error",
      error: { type: "rate_limit_error", message: "slow" },
    },
  };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "rate_limited",
  });
  reply = {
    status: 500,
    body: { type: "error", error: { type: "api_error", message: "boom" } },
  };
  assert.deepEqual(await suggestHint(input, client()), {
    ok: false,
    reason: "unavailable",
  });
});

test("database: flag off by default, admin-only, audited, rate-limited", async () => {
  const A = "b1111111-1111-4111-8111-111111111111",
    G = "b2222222-2222-4222-8222-222222222222";
  const h = await harness([
    [A, true],
    [G, true],
  ]);
  try {
    await h.db.query(
      "insert into private.staff(user_id,role) values($1,'admin')",
      [A],
    );
    const step = (
      await h.one<{ id: string }>(
        "select id from public.challenge_steps limit 1",
      )
    ).id;
    const log = (u: string) =>
      h.as(u, "select public.qz_q_suggest_log($1,'claude-opus-5-5',42)", [
        step,
      ]);
    await assert.rejects(() => log(A), /Q suggestions are off/);
    await h.db.query(
      "update private.feature_flags set enabled=true where flag='q_live'",
    );
    await assert.rejects(() => log(G), /administrator/);
    await log(A);
    const row = await h.one<{ detail: { model: string; chars: number } }>(
      "select detail from public.audit_events where action='q_suggest'",
    );
    assert.deepEqual(row.detail, { model: "claude-opus-5-5", chars: 42 });
    for (let i = 0; i < 30; i++)
      await h.as(A, "select public.qz_rate('q_suggest')");
    await assert.rejects(
      () => h.as(A, "select public.qz_rate('q_suggest')"),
      /Too many attempts/,
    );
  } finally {
    await h.db.close();
  }
});
