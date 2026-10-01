import { NextResponse } from "next/server";
import { apifySessionCookie } from "@/lib/auth/apify-session";

export const runtime = "nodejs";

export function POST() {
  const response = NextResponse.json({
    ok: true,
    connected: false
  });

  response.cookies.set(apifySessionCookie.name, "", {
    ...apifySessionCookie.options,
    maxAge: 0
  });

  return response;
}
