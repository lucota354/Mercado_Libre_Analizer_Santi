import type { MercadoLibreSession } from "./meli-session";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id?: number;
  refresh_token: string;
};

function credentials() {
  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Faltan MELI_CLIENT_ID, MELI_CLIENT_SECRET o MELI_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

async function tokenRequest(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Mercado Libre OAuth ${response.status}: ${body.slice(0, 500)}`
    );
  }

  return response.json() as Promise<TokenResponse>;
}

function toSession(token: TokenResponse): MercadoLibreSession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(60, token.expires_in - 120) * 1000,
    userId: token.user_id
  };
}

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string
): Promise<MercadoLibreSession> {
  const { clientId, clientSecret, redirectUri } = credentials();

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  return toSession(await tokenRequest(params));
}

export async function refreshMercadoLibreSession(
  refreshToken: string
): Promise<MercadoLibreSession> {
  const { clientId, clientSecret } = credentials();

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  });

  return toSession(await tokenRequest(params));
}
