import crypto from "node:crypto";

export type MercadoLibreSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: number;
};

const COOKIE_NAME = "meli_session";

function key() {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SESSION_ENCRYPTION_KEY no está configurado.");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSession(session: MercadoLibreSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value?: string | null): MercadoLibreSession | null {
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

    return JSON.parse(plaintext) as MercadoLibreSession;
  } catch {
    return null;
  }
}

export const mercadoLibreSessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  }
};
