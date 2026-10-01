import { NextResponse } from "next/server";
import {
  apifySessionCookie,
  encryptApifySession
} from "@/lib/auth/apify-session";

export const runtime = "nodejs";

type RequestBody = {
  token?: string;
};

type ApifyMeResponse = {
  data?: {
    id?: string;
    username?: string;
    email?: string;
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Pegá tu API token de Apify." },
        { status: 400 }
      );
    }

    if (token.length < 20) {
      return NextResponse.json(
        { ok: false, error: "El token de Apify parece incompleto." },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const raw = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            response.status === 401 || response.status === 403
              ? "Apify rechazó el token. Copialo nuevamente desde Settings → API & Integrations."
              : `No se pudo verificar Apify (HTTP ${response.status}).`
        },
        { status: response.status === 401 || response.status === 403 ? 401 : 502 }
      );
    }

    let payload: ApifyMeResponse = {};

    try {
      payload = JSON.parse(raw) as ApifyMeResponse;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Apify respondió con un formato inesperado." },
        { status: 502 }
      );
    }

    const username =
      payload.data?.username || payload.data?.email || payload.data?.id;

    const encrypted = encryptApifySession({
      apiToken: token,
      username,
      configuredAt: Date.now()
    });

    const result = NextResponse.json({
      ok: true,
      connected: true,
      username: username ?? null
    });

    result.cookies.set(
      apifySessionCookie.name,
      encrypted,
      apifySessionCookie.options
    );

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo conectar Apify.";

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
