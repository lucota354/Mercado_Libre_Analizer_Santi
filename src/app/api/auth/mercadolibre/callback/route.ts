import { NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/auth/mercadolibre-oauth";
import {
  encryptSession,
  mercadoLibreSessionCookie
} from "@/lib/auth/meli-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf("=");
        return [
          decodeURIComponent(entry.slice(0, index)),
          decodeURIComponent(entry.slice(index + 1))
        ];
      })
  );

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/?meli=error&reason=${encodeURIComponent(
          errorDescription ?? error
        )}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.json({
      ok: true,
      ready: true,
      message:
        "Callback de Mercado Libre activo. Esta URL puede registrarse como Redirect URI."
    });
  }

  if (!returnedState || returnedState !== cookies.meli_oauth_state) {
    return NextResponse.json(
      { ok: false, error: "State OAuth inválido o vencido." },
      { status: 400 }
    );
  }

  const codeVerifier = cookies.meli_pkce_verifier;
  if (!codeVerifier) {
    return NextResponse.json(
      { ok: false, error: "Falta el code_verifier de PKCE." },
      { status: 400 }
    );
  }

  try {
    const session = await exchangeAuthorizationCode(code, codeVerifier);
    const response = NextResponse.redirect(
      new URL("/?meli=connected", request.url)
    );

    response.cookies.set(
      mercadoLibreSessionCookie.name,
      encryptSession(session),
      mercadoLibreSessionCookie.options
    );
    response.cookies.delete("meli_oauth_state");
    response.cookies.delete("meli_pkce_verifier");

    return response;
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "No se pudo completar OAuth.";

    return NextResponse.redirect(
      new URL(
        `/?meli=error&reason=${encodeURIComponent(message.slice(0, 250))}`,
        request.url
      )
    );
  }
}
