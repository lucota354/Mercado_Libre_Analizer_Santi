import { NextResponse } from "next/server";
import {
  decryptSession,
  mercadoLibreSessionCookie
} from "@/lib/auth/meli-session";

export const runtime = "nodejs";

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    const key = decodeURIComponent(trimmed.slice(0, index));
    if (key === name) return decodeURIComponent(trimmed.slice(index + 1));
  }
  return null;
}

export function GET(request: Request) {
  const encrypted = readCookie(request, mercadoLibreSessionCookie.name);
  const session = decryptSession(encrypted);

  const cookiePresent = Boolean(encrypted);
  const encryptionConfigured = Boolean(process.env.SESSION_ENCRYPTION_KEY);
  const connected = Boolean(session?.accessToken);

  return NextResponse.json({
    connected,
    searchScraperConfigured: Boolean(process.env.APIFY_TOKEN),
    cookiePresent,
    encryptionConfigured,
    connectionState: connected
      ? "connected"
      : cookiePresent
        ? "invalid_session"
        : "no_session",
    expiresAt: session?.expiresAt ?? null,
    userId: session?.userId ?? null
  });
}
