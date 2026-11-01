import { NextResponse } from "next/server";
import { publicError } from "@/lib/errors";
import { explorerLocked, LOCKED_MESSAGE } from "@/lib/household";
import { guardian } from "@/lib/supabase";

// Administrator-only Workflow OS overview: definitions, recent runs with step logs,
// dead letters. No household ids, payloads, or names (enforced in the database).
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { db } = await guardian();
    if (await explorerLocked(db))
      return NextResponse.json(
        { error: LOCKED_MESSAGE },
        { status: 403, headers },
      );
    const { data, error } = await db.rpc("qz_workflows");
    if (error) {
      const e = publicError(error, "ops:workflows");
      return NextResponse.json(
        { error: e.error },
        { status: e.status === 400 ? 403 : e.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Please sign in again." },
      { status: 401, headers },
    );
  }
}
