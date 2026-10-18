import { NextResponse, type NextRequest } from "next/server";
import { database } from "@/lib/supabase";
import { safeNext } from "@/lib/validation";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const db = await database();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            safeNext(req.nextUrl.searchParams.get("next")),
            req.nextUrl.origin,
          ),
        );
    } catch {}
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", req.nextUrl.origin),
  );
}
