import {
  decryptSession,
  encryptSession,
  mercadoLibreSessionCookie,
  type MercadoLibreSession
} from "./meli-session";
import { refreshMercadoLibreSession } from "./mercadolibre-oauth";

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;

    const key = decodeURIComponent(trimmed.slice(0, index));
    if (key === name) {
      return decodeURIComponent(trimmed.slice(index + 1));
    }
  }

  return null;
}

export type ResolvedMercadoLibreSession = {
  session: MercadoLibreSession;
  refreshed: boolean;
};

export async function resolveMercadoLibreSession(
  request: Request
): Promise<ResolvedMercadoLibreSession | null> {
  const encrypted = readCookie(request, mercadoLibreSessionCookie.name);
  const existing = decryptSession(encrypted);

  if (!existing) {
    const fallback = process.env.MELI_ACCESS_TOKEN;
    if (!fallback) return null;

    return {
      session: {
        accessToken: fallback,
        refreshToken: "",
        expiresAt: Number.MAX_SAFE_INTEGER
      },
      refreshed: false
    };
  }

  if (existing.expiresAt > Date.now()) {
    return { session: existing, refreshed: false };
  }

  if (!existing.refreshToken) return null;

  const refreshedSession = await refreshMercadoLibreSession(existing.refreshToken);
  return { session: refreshedSession, refreshed: true };
}

export function attachMercadoLibreSessionCookie(
  response: import("next/server").NextResponse,
  session: MercadoLibreSession
) {
  response.cookies.set(
    mercadoLibreSessionCookie.name,
    encryptSession(session),
    mercadoLibreSessionCookie.options
  );
}
