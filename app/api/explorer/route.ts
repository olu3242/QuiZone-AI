import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicError } from "@/lib/errors";
import { sameOrigin } from "@/lib/http";
import { explorerLocked } from "@/lib/household";
import { guardian } from "@/lib/supabase";

const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers: noStore });
const unlockSchema = z.object({ password: z.string().min(1).max(200) });

// Leave Explorer mode: the adult re-enters their password. Signing in again replaces
// this device's locked Auth session with a new one, which has no lock. Nothing the
// client sends can lift a lock without the password.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Request origin not allowed.", 403);
  const body = unlockSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Enter your password.");
  try {
    const { db, user } = await guardian();
    if (!(await explorerLocked(db)))
      return NextResponse.json({ unlocked: true }, { headers: noStore });
    const budget = await db.rpc("qz_rate", { bucket: "reauth" });
    if (budget.error) {
      const e = publicError(budget.error, "explorer:unlock");
      return fail(e.error, e.status);
    }
    const { error } = await db.auth.signInWithPassword({
      email: user.email!,
      password: body.data.password,
    });
    if (error) return fail("That password didn’t match.", 403);
    return NextResponse.json({ unlocked: true }, { headers: noStore });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Please sign in again.",
      401,
    );
  }
}
