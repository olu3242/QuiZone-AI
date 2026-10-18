import { NextResponse, type NextRequest } from "next/server";
import { guardian } from "@/lib/supabase";
import { sameOrigin } from "@/lib/http";
import { authorize } from "@/lib/authorize";
import { actionSchema } from "@/lib/validation";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  try {
    const { db, user } = await guardian();
    if (Number(req.headers.get("content-length") || 0) > 16000)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const body = actionSchema.safeParse(await req.json());
    if (!body.success)
      return NextResponse.json(
        { error: body.error.issues.map((x) => x.message).join(" ") },
        { status: 400 },
      );
    await authorize(db, user.id, body.data);
    const { data, error } = await db.rpc("qz_command", {
      command: body.data.action,
      payload: body.data.data,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save. Please try again.",
      },
      { status: 401 },
    );
  }
}
