import { explorerLocked, LOCKED_MESSAGE } from "@/lib/household";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ownsChild } from "@/lib/authorize";
import { sameOrigin } from "@/lib/http";
import { publicError } from "@/lib/errors";
import { guardian } from "@/lib/supabase";
import { safezoneConsentSchema } from "@/lib/validation";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers: noStore });

// GET ?hall=<id>&child=<id> → room view; no params → lobby. Both are sanitized
// SECURITY DEFINER reads: peers appear only as per-session handles.
export async function GET(req: NextRequest) {
  try {
    const { db } = await guardian();
    if (await explorerLocked(db))
      return NextResponse.json(
        { error: LOCKED_MESSAGE },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    const hall = req.nextUrl.searchParams.get("hall");
    if (!hall) {
      const { data, error } = await db.rpc("qz_safezone_lobby");
      if (error) return fail("SafeZone is unavailable right now.", 503);
      return NextResponse.json(data, { headers: noStore });
    }
    const ids = z
      .object({ hall: z.string().uuid(), child: z.string().uuid().nullable() })
      .safeParse({ hall, child: req.nextUrl.searchParams.get("child") });
    if (!ids.success) return fail("Invalid town hall link.", 404);
    const { data, error } = await db.rpc("qz_safezone_room", ids.data);
    if (error) {
      const e = publicError(error, "safezone:room");
      return fail(e.error, e.status === 400 ? 403 : e.status);
    }
    return NextResponse.json(data, { headers: noStore });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
}

// POST: consent-granting actions. The guardian's password is verified here, which
// mints a session whose JWT carries a fresh password `amr`; the database refuses
// consent unless that claim is under five minutes old.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Request origin not allowed.", 403);
  let session: Awaited<ReturnType<typeof guardian>>;
  try {
    session = await guardian();
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
  const parsed = safezoneConsentSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return fail(parsed.error.issues.map((i) => i.message).join(" "));
  const { db, user } = session;
  if (await explorerLocked(db))
    return NextResponse.json(
      { error: LOCKED_MESSAGE },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  const input = parsed.data;
  // Password checks are brute-forceable: spend the guardian's reauth budget first.
  const budget = await db.rpc("qz_rate", { bucket: "reauth" });
  if (budget.error) {
    const e = publicError(budget.error, "safezone:reauth");
    return fail(e.error, e.status);
  }
  const check = await db.auth.signInWithPassword({
    email: user.email!,
    password: input.password,
  });
  if (check.error) return fail("Your guardian password is incorrect.");
  try {
    const { data: house } = await db
      .from("households")
      .select("id")
      .eq("guardian_id", user.id)
      .single();
    if (!house) return fail("Create a household first.", 403);
    if (input.action === "sz_register")
      await ownsChild(db, house.id, input.data.child);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Permission denied.",
      403,
    );
  }
  const { data, error } = await db.rpc("qz_command", {
    command: input.action,
    payload: input.data,
  });
  if (error) {
    const e = publicError(error, `safezone:${input.action}`);
    return fail(e.error, e.status);
  }
  return NextResponse.json(data, { headers: noStore });
}
