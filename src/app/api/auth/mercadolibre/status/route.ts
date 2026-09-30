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

  return NextResponse.json({
    connected: Boolean(session?.accessToken),
    expiresAt: session?.expiresAt ?? null,
    userId: session?.userId ?? null
  });
}
