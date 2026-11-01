import Anthropic from "@anthropic-ai/sdk";
import { screenHint } from "./q-screen";

// Q's live-model boundary. Server-only by construction: the key is read from a
// non-public env var and this module is imported only by route handlers.
// Output is a *suggestion for a content author* — it is screened here, edited by a
// person, and published only through the CMS quality gate and age review.
if (typeof window !== "undefined")
  throw new Error("The Q provider runs on the server only.");

export const Q_MODEL = process.env.QZ_Q_MODEL || "claude-opus-5-5";

export function qConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write one hint for a family learning game played by children aged 8 to 17 with a grown-up.
Rules:
- Reply with the hint only: one or two short sentences, under 240 characters, plain text.
- Nudge thinking (a question to consider, a clue about the idea); never say which option is correct and never repeat an option's wording.
- Warm, encouraging, age-appropriate. No links, names, personal questions, or requests to chat.
- If the question is unsuitable for children, reply exactly: UNSUITABLE`;

export type SuggestInput = {
  title: string;
  prompt: string;
  options: string[];
  minAge: number;
  maxAge: number;
};
export type SuggestResult =
  | { ok: true; hint: string; model: string }
  | {
      ok: false;
      reason: "screened" | "refused" | "rate_limited" | "unavailable";
    };

export async function suggestHint(
  input: SuggestInput,
  client: Anthropic = new Anthropic({ timeout: 20_000, maxRetries: 1 }),
): Promise<SuggestResult> {
  // Only content fields are sent — never any family, explorer, or account data.
  const content = [
    `Challenge: ${input.title}`,
    `Ages: ${input.minAge}-${input.maxAge}`,
    `Question: ${input.prompt}`,
    `Options: ${input.options.map((o, i) => `${i + 1}) ${o}`).join("; ")}`,
  ].join("\n");
  try {
    const response = await client.beta.messages.create({
      model: Q_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low" },
      // On a safety decline, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal")
      return { ok: false, reason: "refused" };
    if (response.stop_reason !== "end_turn")
      return { ok: false, reason: "screened" };
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (text === "UNSUITABLE") return { ok: false, reason: "refused" };
    const hint = screenHint(text, input.options);
    return hint
      ? { ok: true, hint, model: response.model }
      : { ok: false, reason: "screened" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError)
      return { ok: false, reason: "rate_limited" };
    if (
      error instanceof Anthropic.APIError ||
      error instanceof Anthropic.APIConnectionError
    ) {
      console.error(
        "q-provider",
        error instanceof Anthropic.APIError ? error.status : "connection",
      );
      return { ok: false, reason: "unavailable" };
    }
    throw error;
  }
}
