import { NextResponse, type NextRequest } from "next/server";
import { publicError } from "@/lib/errors";
import { sameOrigin } from "@/lib/http";
import { explorerLocked, LOCKED_MESSAGE } from "@/lib/household";
import { guardian } from "@/lib/supabase";

const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

// Administrator-only: recent maintenance runs (GET) and "run now" (POST).
// Authorization is enforced in the database; this route adds the lock check.
async function call(fn: "qz_maintenance_runs" | "qz_maintenance") {
  try {
    const { db } = await guardian();
    if (await explorerLocked(db)) return fail(LOCKED_MESSAGE, 403);
    const { data, error } = await db.rpc(fn);
    if (error) {
      const e = publicError(error, `ops:${fn}`);
      return fail(e.error, e.status === 400 ? 403 : e.status);
    }
    return NextResponse.json(data, { headers });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Please sign in again.", 401);
  }
}
export async function GET() {
  return call("qz_maintenance_runs");
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail("Request origin not allowed.", 403);
  return call("qz_maintenance");
}
