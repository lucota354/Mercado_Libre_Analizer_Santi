import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function base64url(input: Buffer) {
  return input.toString("base64url");
}

export function GET(request: Request) {
  const clientId = process.env.MELI_CLIENT_ID;
  const redirectUri =
    process.env.MELI_REDIRECT_URI ??
    new URL("/api/auth/mercadolibre/callback", request.url).toString();

  if (!clientId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "MELI_CLIENT_ID todavía no está configurado en las variables de entorno."
      },
      { status: 503 }
    );
  }

  const state = base64url(crypto.randomBytes(24));
  const codeVerifier = base64url(crypto.randomBytes(48));
  const codeChallenge = base64url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const authorizationUrl = new URL(
    "https://auth.mercadolibre.com.ar/authorization"
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authorizationUrl);

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/api/auth/mercadolibre",
    maxAge: 10 * 60
  };

  response.cookies.set("meli_oauth_state", state, cookieOptions);
  response.cookies.set("meli_pkce_verifier", codeVerifier, cookieOptions);

  return response;
}
