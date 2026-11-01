import { explorerLocked, LOCKED_MESSAGE } from "@/lib/household";
import { NextResponse } from "next/server";
import { publicError } from "@/lib/errors";
import { guardian } from "@/lib/supabase";

// GET: staff-only aggregate operations overview (no personal data).
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { db } = await guardian();
    if (await explorerLocked(db))
      return NextResponse.json(
        { error: LOCKED_MESSAGE },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    const { data, error } = await db.rpc("qz_ops_overview");
    if (error) {
      const e = publicError(error, "ops:overview");
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
