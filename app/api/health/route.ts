import { NextResponse } from "next/server";
import { configured } from "@/lib/supabase";
export function GET() {
  return NextResponse.json(
    {
      application: "QuiZone",
      status: "running",
      accountsConfigured: configured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
