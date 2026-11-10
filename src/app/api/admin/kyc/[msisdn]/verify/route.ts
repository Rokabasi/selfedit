import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidMsisdn } from "@/lib/phone";
import { apiError, readJson } from "@/lib/server/http";
import { getRecord, updateStatus } from "@/lib/server/storage";
import { canApprove, runChecks } from "@/lib/server/verification";

export const runtime = "nodejs";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(5, "Motif trop court").max(300) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ msisdn: string }> }) {
  const { msisdn } = await params;
  if (!isValidMsisdn(msisdn)) return apiError(400, "INVALID_MSISDN", "Numéro invalide");

  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return apiError(400, "INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Requête invalide");
  }

  const record = await getRecord(msisdn);
  if (!record) return apiError(404, "NOT_FOUND", "Dossier introuvable");

  const checks = await runChecks(record);
  const operator = "back-office";

  if (parsed.data.action === "reject") {
    const updated = await updateStatus(msisdn, { status: "REJECTED", checks, by: operator, reason: parsed.data.reason });
    return NextResponse.json({ status: updated?.status, checks });
  }

  if (!canApprove(checks)) {
    return NextResponse.json({ status: record.status, checks, approved: false });
  }
  const updated = await updateStatus(msisdn, {
    status: "APPROVED",
    checks,
    by: operator,
    reason: "Contrôles automatiques conformes",
  });
  return NextResponse.json({ status: updated?.status, checks, approved: true });
}
