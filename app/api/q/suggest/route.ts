import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicError } from "@/lib/errors";
import { sameOrigin } from "@/lib/http";
import { explorerLocked, LOCKED_MESSAGE } from "@/lib/household";
import { qConfigured, suggestHint } from "@/lib/q-adapter";
import { guardian } from "@/lib/supabase";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: noStore });
const body = z.object({ step: z.string().uuid() });
const reasons = {
  screened: [
    "Q’s suggestion didn’t pass the safety checks. Write this hint yourself.",
    422,
  ],
  refused: ["Q declined to suggest a hint for this step.", 422],
  rate_limited: ["Q is busy right now. Try again in a minute.", 429],
  unavailable: ["Q is unavailable right now. Write this hint yourself.", 503],
} as const;

// Admin-only: a live-model hint *suggestion* for one CMS step. Never shown to a child
// directly — the author edits it and publishes through the normal review gates.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Request origin not allowed.", 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid step.", 400);
  try {
    const { db } = await guardian();
    if (await explorerLocked(db)) return fail(LOCKED_MESSAGE, 403);
    const { data: admin } = await db.rpc("qz_is_staff", {
      required_role: "admin",
    });
    if (!admin)
      return fail("Content tools require an administrator role.", 403);
    const { data: flags } = await db.rpc("qz_flags");
    if (!(flags as Record<string, boolean> | null)?.q_live)
      return fail("Q suggestions are off.", 404);
    if (!qConfigured())
      return fail("Q suggestions aren’t configured on this server.", 503);
    const budget = await db.rpc("qz_rate", { bucket: "q_suggest" });
    if (budget.error) {
      const e = publicError(budget.error, "q:suggest");
      return fail(e.error, e.status);
    }
    const { data: step, error } = await db
      .from("challenge_steps")
      .select(
        "id,prompt,options,challenge_versions(min_age,max_age,challenges(title))",
      )
      .eq("id", parsed.data.step)
      .single();
    if (error || !step) return fail("Step not found.", 404);
    const v = step.challenge_versions as unknown as {
      min_age: number;
      max_age: number;
      challenges: { title: string };
    };
    const result = await suggestHint({
      title: v.challenges.title,
      prompt: step.prompt,
      options: step.options as string[],
      minAge: v.min_age,
      maxAge: v.max_age,
    });
    if (!result.ok) {
      const [message, status] = reasons[result.reason];
      return fail(message, status);
    }
    const log = await db.rpc("qz_q_suggest_log", {
      step: step.id,
      model: result.model,
      chars: result.hint.length,
    });
    if (log.error) {
      const e = publicError(log.error, "q:log");
      return fail(e.error, e.status);
    }
    return NextResponse.json(
      { hint: result.hint, model: result.model, reviewed: false },
      { headers: noStore },
    );
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
}
