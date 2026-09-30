import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
          "MELI_CLIENT_ID todavía no está configurado. Primero creá la aplicación en Mercado Libre."
      },
      { status: 503 }
    );
  }

  const authorizationUrl = new URL(
    "https://auth.mercadolibre.com.ar/authorization"
  );
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authorizationUrl);
}
