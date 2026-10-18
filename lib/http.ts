import type { NextRequest } from "next/server";
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return (
    origin === req.nextUrl.origin ||
    (Boolean(process.env.NEXT_PUBLIC_SITE_URL) &&
      origin === process.env.NEXT_PUBLIC_SITE_URL)
  );
}
