import { NextResponse } from "next/server";
import { normalizeMsisdn } from "@/lib/phone";
import { apiError } from "@/lib/server/http";
import { getRecord } from "@/lib/server/storage";

export const runtime = "nodejs";

/** Consultation publique du statut : n'expose aucune donnée personnelle. */
export async function GET(req: Request) {
  const msisdn = normalizeMsisdn(new URL(req.url).searchParams.get("msisdn") ?? "");
  if (!msisdn) return apiError(400, "INVALID_MSISDN", "Numéro de téléphone invalide");

  const record = await getRecord(msisdn);
  if (!record) return apiError(404, "NOT_FOUND", "Aucun dossier KYC pour ce numéro");

  return NextResponse.json({
    msisdn,
    reference: record.reference,
    status: record.status,
    submittedAt: record.createdAt,
    updatedAt: record.updatedAt,
    reason: record.status === "REJECTED" ? (record.verification?.reason ?? null) : null,
  });
}
