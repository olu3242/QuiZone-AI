import { NextResponse, type NextRequest } from "next/server";
import { gameData } from "@/lib/game-data";
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      await gameData(req.nextUrl.searchParams.get("id") || ""),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load session.",
      },
      { status: 404 },
    );
  }
}
