import { NextResponse } from "next/server";
import { submissionSchema, flattenIssues } from "@/lib/schemas";
import { apiError, clientIp, readJson } from "@/lib/server/http";
import { createRecord, KycConflictError } from "@/lib/server/storage";
import { bearer, verifySessionToken } from "@/lib/server/token";

export const runtime = "nodejs";

/** Soumission d'un dossier self-KYC. */
export async function POST(req: Request) {
  const parsed = submissionSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return apiError(422, "VALIDATION_ERROR", "Certaines informations sont invalides", flattenIssues(parsed.error));
  }
  if (!verifySessionToken(bearer(req.headers.get("authorization")), parsed.data.msisdn)) {
    return apiError(401, "SESSION_EXPIRED", "Votre session a expiré. Veuillez revalider votre numéro.");
  }

  try {
    const record = await createRecord(parsed.data, {
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json(
      { reference: record.reference, status: record.status, createdAt: record.createdAt },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof KycConflictError) return apiError(409, `ALREADY_${err.status}`, err.message);
    console.error("[kyc] échec d'enregistrement", err);
    return apiError(500, "STORAGE_ERROR", "Impossible d'enregistrer votre dossier. Réessayez.");
  }
}
