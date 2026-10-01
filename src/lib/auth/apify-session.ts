import crypto from "node:crypto";

export type ApifySession = {
  apiToken: string;
  username?: string;
  configuredAt: number;
};

const COOKIE_NAME = "apify_session";

function key() {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SESSION_ENCRYPTION_KEY no está configurado.");
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptApifySession(session: ApifySession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptApifySession(
  value?: string | null
): ApifySession | null {
  if (!value) return null;

  try {
    const packed = Buffer.from(value, "base64url");
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString("utf8");

    return JSON.parse(plaintext) as ApifySession;
  } catch {
    return null;
  }
}

export const apifySessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 180
  }
};

export function readRequestCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const entry of cookieHeader.split(";")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const index = trimmed.indexOf("=");
    if (index < 0) continue;

    const cookieName = decodeURIComponent(trimmed.slice(0, index));
    if (cookieName === name) {
      return decodeURIComponent(trimmed.slice(index + 1));
    }
  }

  return null;
}

export type ResolvedApifyAuth = {
  apiToken: string;
  username?: string;
  source: "cookie" | "environment";
};

export function resolveApifyAuth(
  request: Request
): ResolvedApifyAuth | null {
  const encrypted = readRequestCookie(request, apifySessionCookie.name);
  const session = decryptApifySession(encrypted);

  if (session?.apiToken) {
    return {
      apiToken: session.apiToken,
      username: session.username,
      source: "cookie"
    };
  }

  const fallback = process.env.APIFY_TOKEN;
  if (fallback) {
    return {
      apiToken: fallback,
      source: "environment"
    };
  }

  return null;
}
