import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeMsisdn, isAirtelMsisdn } from "@/lib/phone";
import { apiError, readJson } from "@/lib/server/http";
import { getRecord } from "@/lib/server/storage";

export const runtime = "nodejs";

const bodySchema = z.object({ msisdn: z.string() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await readJson(req));
  const msisdn = parsed.success ? normalizeMsisdn(parsed.data.msisdn) : null;
  if (!msisdn) return apiError(400, "INVALID_MSISDN", "Numéro de téléphone invalide");
  if (!isAirtelMsisdn(msisdn)) {
    return apiError(400, "NOT_AIRTEL", "Ce numéro n'est pas un numéro Airtel (097, 098 ou 099)");
  }

  const existing = await getRecord(msisdn);
  if (existing?.status === "APPROVED") {
    return apiError(409, "ALREADY_APPROVED", "Ce numéro est déjà identifié. Aucune action n'est nécessaire.");
  }
  if (existing?.status === "PENDING") {
    return apiError(409, "ALREADY_PENDING", `Un dossier est déjà en cours de vérification (réf. ${existing.reference}).`);
  }

  // Démo : pas de passerelle SMS. En production → appel SMSC / API OTP.
  return NextResponse.json({ msisdn, expiresInSec: 300, demo: true });
}
