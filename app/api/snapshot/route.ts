import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/http";
import { snapshot } from "@/lib/snapshot";
export async function GET() {
  try {
    return NextResponse.json(await snapshot(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load family data.",
      },
      { status: 401 },
    );
  }
}
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  const { guardian } = await import("@/lib/supabase");
  try {
    const { db } = await guardian();
    const { error } = await db.auth.signOut();
    if (error) throw new Error("Sign out failed.");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Sign out failed." }, { status: 400 });
  }
}
