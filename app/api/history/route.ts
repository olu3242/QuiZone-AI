import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guardian } from "@/lib/supabase";

const PAGE = 20;
// GET ?before=<ISO timestamp>: the household's completed sessions older than
// `before`, newest first. Explicit household predicate plus RLS.
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const before = z
      .string()
      .datetime({ offset: true }) // Postgres returns +00:00, not Z
      .safeParse(req.nextUrl.searchParams.get("before"));
    if (!before.success)
      return NextResponse.json(
        { error: "Invalid cursor." },
        { status: 400, headers },
      );
    const { db, user } = await guardian();
    const { data: house } = await db
      .from("households")
      .select("id")
      .eq("guardian_id", user.id)
      .single();
    if (!house)
      return NextResponse.json({ sessions: [], more: false }, { headers });
    const { data, error } = await db
      .from("game_sessions")
      .select(
        "id,code,state,created_at,expires_at,completed_at,total_score,practice,challenge_version_id",
      )
      .eq("household_id", house.id)
      .eq("state", "complete")
      .lt("created_at", before.data)
      .order("created_at", { ascending: false })
      .limit(PAGE + 1);
    if (error)
      return NextResponse.json(
        { error: "Could not load history." },
        { status: 400, headers },
      );
    return NextResponse.json(
      { sessions: data.slice(0, PAGE), more: data.length > PAGE },
      { headers },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Please sign in again." },
      { status: 401, headers },
    );
  }
}
