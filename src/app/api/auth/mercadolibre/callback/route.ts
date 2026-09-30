import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Mercado Libre OAuth callback.
 *
 * This route exists from the first deployment so its HTTPS URL can be registered
 * in Mercado Libre Developers before client credentials are available.
 *
 * Token exchange/persistence is intentionally completed only after
 * MELI_CLIENT_ID / MELI_CLIENT_SECRET are configured securely in Vercel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error,
        errorDescription:
          errorDescription ?? "Mercado Libre rechazó o canceló la autorización."
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json({
      ok: true,
      ready: true,
      message:
        "Callback de Mercado Libre activo. Esta URL ya puede registrarse como Redirect URI."
    });
  }

  return NextResponse.json({
    ok: true,
    authorizationCodeReceived: true,
    message:
      "Código OAuth recibido. Falta configurar las credenciales y persistencia segura para intercambiarlo por tokens."
  });
}
