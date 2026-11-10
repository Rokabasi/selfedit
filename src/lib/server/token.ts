import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton de session KYC sans état : `<msisdn>.<expiration>.<signature HMAC-SHA256>`.
 * Émis après validation de l'OTP, exigé pour soumettre le dossier du même numéro.
 */
const TOKEN_TTL_MS = 45 * 60 * 1000;

function secret(): string {
  const s = process.env.KYC_TOKEN_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("KYC_TOKEN_SECRET doit être défini en production");
  }
  return s ?? "dev-only-insecure-secret";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function issueSessionToken(msisdn: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${msisdn}.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifySessionToken(token: string | null | undefined, msisdn: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokMsisdn, exp, sig] = parts as [string, string, string];
  if (tokMsisdn !== msisdn || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(`${tokMsisdn}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function bearer(header: string | null): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
}
