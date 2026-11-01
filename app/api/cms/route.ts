import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicError } from "@/lib/errors";
import { guardian } from "@/lib/supabase";

// GET ?version=<id>: admin-only editing view (includes answer keys and quality findings).
export async function GET(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { db } = await guardian();
    const id = z
      .string()
      .uuid()
      .safeParse(req.nextUrl.searchParams.get("version"));
    if (!id.success)
      return NextResponse.json(
        { error: "Invalid version." },
        { status: 404, headers },
      );
    const { data, error } = await db.rpc("qz_cms_version", { vid: id.data });
    if (error) {
      const e = publicError(error, "cms:version");
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
