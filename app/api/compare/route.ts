import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicError } from "@/lib/errors";
import { guardian } from "@/lib/supabase";

// Global Connect: aggregate, k-anonymous answer distributions for a WorldZone session
// the caller's household played. The database refuses anything else.
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  const id = z
    .string()
    .uuid()
    .safeParse(req.nextUrl.searchParams.get("session"));
  if (!id.success)
    return NextResponse.json(
      { error: "Invalid session." },
      { status: 400, headers },
    );
  try {
    const { db } = await guardian();
    const { data, error } = await db.rpc("qz_world_compare", {
      session: id.data,
    });
    if (error) {
      const e = publicError(error, "compare");
      return NextResponse.json(
        { error: e.error },
        { status: e.status === 400 ? 404 : e.status, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Please sign in again.",
      },
      { status: 401, headers },
    );
  }
}
