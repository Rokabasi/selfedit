import { AIRTEL_PREFIXES } from "./constants";

/**
 * Normalise un numéro congolais au format international sans "+" : 243XXXXXXXXX.
 * Accepte 0991234567, 991234567, +243991234567, 243 99 123 45 67…
 * Retourne null si le numéro n'est pas un mobile RDC valide.
 */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local: string;
  if (digits.length === 12 && digits.startsWith("243")) local = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else return null;
  return /^[89]\d{8}$/.test(local) ? `243${local}` : null;
}

export function isAirtelMsisdn(msisdn: string): boolean {
  return (AIRTEL_PREFIXES as readonly string[]).includes(msisdn.slice(3, 5));
}

/** 243991234567 → +243 99 123 4567 */
export function formatMsisdn(msisdn: string): string {
  const m = /^243(\d{2})(\d{3})(\d{4})$/.exec(msisdn);
  return m ? `+243 ${m[1]} ${m[2]} ${m[3]}` : msisdn;
}

export function isValidMsisdn(value: string): boolean {
  return /^243\d{9}$/.test(value);
}
