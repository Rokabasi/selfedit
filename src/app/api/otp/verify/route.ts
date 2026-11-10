import { NextResponse } from "next/server";
import { z } from "zod";
import { OTP_LENGTH } from "@/lib/constants";
import { normalizeMsisdn } from "@/lib/phone";
import { apiError, readJson } from "@/lib/server/http";
import { checkOtp } from "@/lib/server/otp";
import { issueSessionToken } from "@/lib/server/token";

export const runtime = "nodejs";

const bodySchema = z.object({
  msisdn: z.string(),
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`)),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await readJson(req));
  const msisdn = parsed.success ? normalizeMsisdn(parsed.data.msisdn) : null;
  if (!parsed.success || !msisdn) return apiError(400, "INVALID_REQUEST", "Code ou numéro invalide");

  const result = checkOtp(msisdn, parsed.data.code);
  if (!result.ok) {
    return result.reason === "LOCKED"
      ? apiError(429, "OTP_LOCKED", `Trop de tentatives. Réessayez dans ${Math.ceil(result.retryInSec / 60)} min.`)
      : apiError(400, "OTP_INVALID", `Code incorrect. ${result.remaining} tentative(s) restante(s).`);
  }

  try {
    return NextResponse.json(issueSessionToken(msisdn));
  } catch (err) {
    console.error("[otp] configuration serveur invalide :", (err as Error).message);
    return apiError(500, "SERVER_CONFIG", "Service momentanément indisponible. Réessayez plus tard.");
  }
}
