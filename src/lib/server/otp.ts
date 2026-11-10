/**
 * OTP de démonstration : aucune passerelle SMS, le code attendu est fixe
 * (KYC_OTP_CODE, 1234 par défaut). On limite tout de même les tentatives
 * pour reproduire le comportement d'un vrai service.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

type AttemptState = { count: number; lockedUntil: number };

// Conservé sur globalThis pour survivre au rechargement à chaud en dev.
const g = globalThis as unknown as { __kycOtpAttempts?: Map<string, AttemptState> };
const attempts = (g.__kycOtpAttempts ??= new Map());

export const expectedOtp = () => process.env.KYC_OTP_CODE ?? "1234";

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: "LOCKED"; retryInSec: number }
  | { ok: false; reason: "INVALID"; remaining: number };

export function checkOtp(msisdn: string, code: string): OtpCheck {
  const now = Date.now();
  const state = attempts.get(msisdn) ?? { count: 0, lockedUntil: 0 };

  if (state.lockedUntil > now) {
    return { ok: false, reason: "LOCKED", retryInSec: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  if (code === expectedOtp()) {
    attempts.delete(msisdn);
    return { ok: true };
  }
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) {
    attempts.set(msisdn, { count: 0, lockedUntil: now + LOCK_MS });
    return { ok: false, reason: "LOCKED", retryInSec: LOCK_MS / 1000 };
  }
  attempts.set(msisdn, state);
  return { ok: false, reason: "INVALID", remaining: MAX_ATTEMPTS - state.count };
}

export function resetOtp(msisdn: string) {
  attempts.delete(msisdn);
}
