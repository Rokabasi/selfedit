import { LIVENESS_CHALLENGE_COUNT, MIN_AGE, getIdType } from "@/lib/constants";
import { ageFrom } from "@/lib/schemas";
import type { KycRecord, VerificationCheck } from "@/lib/types";
import { listRecords, getRecord } from "./storage";

/**
 * Moteur de vérification du dossier. En mode démo, l'authentification documentaire
 * accepte toutes les pièces : elle serait ici remplacée par l'appel au fournisseur
 * (OCR/MRZ, contrôle des sécurités, matching visage ↔ photo de la pièce, CENI…).
 */
export async function runChecks(record: KycRecord): Promise<VerificationCheck[]> {
  const idType = getIdType(record.identity.idType);
  const age = ageFrom(record.personal.birthDate);
  const lowQuality = [record.documents.front, record.documents.back].filter((d) => d && !d.meta.qualityOk).length;

  // Même pièce d'identité déjà utilisée sur d'autres numéros (contrôle informatif).
  const others = await listRecords();
  const sameId = (
    await Promise.all(
      others
        .filter((o) => o.msisdn !== record.msisdn && o.idType === record.identity.idType)
        .map((o) => getRecord(o.msisdn)),
    )
  ).filter((r) => r?.identity.idNumber === record.identity.idNumber).length;

  return [
    {
      id: "otp",
      label: "Possession de la SIM (OTP)",
      passed: Boolean(record.otpVerifiedAt),
      blocking: true,
      detail: `OTP validé le ${new Date(record.otpVerifiedAt).toLocaleString("fr-FR")}`,
    },
    {
      id: "document_capture",
      label: "Capture de la pièce d'identité",
      passed: Boolean(record.documents.front) && (!idType?.requiresBack || Boolean(record.documents.back)),
      blocking: true,
      detail: idType?.requiresBack ? "Recto et verso fournis" : "Page d'identité fournie",
    },
    {
      id: "document_auth",
      label: "Authentification du document",
      passed: true,
      blocking: true,
      detail: "Mode démonstration : tous les documents sont acceptés",
    },
    {
      id: "document_quality",
      label: "Qualité de l'image",
      passed: lowQuality === 0,
      blocking: false,
      detail: lowQuality ? `${lowQuality} image(s) sous le seuil de netteté/luminosité` : "Netteté et luminosité correctes",
    },
    {
      id: "liveness",
      label: "Preuve de vie (liveness)",
      passed: record.liveness.challenges.length >= LIVENESS_CHALLENGE_COUNT,
      blocking: true,
      detail:
        record.liveness.method === "face-mesh"
          ? `${record.liveness.challenges.length} défis réussis (détection faciale)`
          : "Mode guidé sans détection automatique : contrôle visuel du selfie recommandé",
    },
    {
      id: "age",
      label: `Âge minimum (${MIN_AGE} ans)`,
      passed: age >= MIN_AGE,
      blocking: true,
      detail: `${age} ans`,
    },
    {
      id: "sim",
      label: "Format ICCID / PUK",
      passed: /^89\d{17,18}$/.test(record.sim.iccid) && Boolean(record.sim.pukHash),
      blocking: true,
      detail: record.sim.iccid.startsWith("89243") ? "SIM émise en RDC (89 243…)" : "Préfixe pays ICCID inhabituel",
    },
    {
      id: "consent",
      label: "Consentements légaux",
      passed:
        record.consent.terms &&
        record.consent.privacy &&
        record.consent.biometrics &&
        record.consent.accuracy &&
        (!record.wantsAirtelMoney || record.consent.airtelMoney),
      blocking: true,
      detail: `Version ${record.consent.version}`,
    },
    {
      id: "duplicate_id",
      label: "Pièce utilisée sur d'autres numéros",
      passed: sameId === 0,
      blocking: false,
      detail: sameId ? `Pièce déjà déclarée sur ${sameId} autre(s) numéro(s)` : "Aucun autre numéro",
    },
  ];
}

export const canApprove = (checks: VerificationCheck[]) => checks.every((c) => c.passed || !c.blocking);
