import { NextResponse } from "next/server";
import {
  apifySessionCookie,
  decryptApifySession,
  readRequestCookie
} from "@/lib/auth/apify-session";

export const runtime = "nodejs";

export function GET(request: Request) {
  const encrypted = readRequestCookie(request, apifySessionCookie.name);
  const session = decryptApifySession(encrypted);
  const environmentConfigured = Boolean(process.env.APIFY_TOKEN);

  return NextResponse.json({
    connected: Boolean(session?.apiToken) || environmentConfigured,
    source: session?.apiToken
      ? "browser"
      : environmentConfigured
        ? "environment"
        : "none",
    username: session?.username ?? null,
    configuredAt: session?.configuredAt ?? null,
    cookiePresent: Boolean(encrypted),
    encryptionConfigured: Boolean(process.env.SESSION_ENCRYPTION_KEY)
  });
}
