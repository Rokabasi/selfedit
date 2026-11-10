import type { ChallengeType, IdType } from "./constants";
import type { ScanMeta } from "./schemas";

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface VerificationCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Un contrôle bloquant en échec empêche l'approbation. */
  blocking: boolean;
  detail?: string;
}

export interface KycHistoryEntry {
  at: string;
  status: KycStatus;
  by: string;
  note?: string;
}

/** Dossier KYC tel que persisté dans data/kyc/<msisdn>.json */
export interface KycRecord {
  schemaVersion: 1;
  reference: string;
  msisdn: string;
  status: KycStatus;
  createdAt: string;
  updatedAt: string;
  otpVerifiedAt: string;
  wantsAirtelMoney: boolean;
  identity: { idType: IdType; idNumber: string };
  personal: {
    lastName: string;
    middleName: string;
    firstName: string;
    birthPlace: string;
    birthDate: string;
    email: string;
    altPhones: string[];
    district: string;
    city: string;
    village: string;
    address: string;
  };
  /** Le PUK n'est jamais stocké en clair. */
  sim: { iccid: string; pukHash: string; pukHint: string };
  documents: {
    front: { file: string; meta: ScanMeta };
    back: { file: string; meta: ScanMeta } | null;
  };
  liveness: {
    method: "face-mesh" | "guided";
    selfieFile: string;
    challenges: { type: ChallengeType; completedAt: number }[];
    durationMs: number;
  };
  consent: {
    version: string;
    acceptedAt: string;
    terms: boolean;
    privacy: boolean;
    biometrics: boolean;
    accuracy: boolean;
    airtelMoney: boolean;
    ip: string | null;
    userAgent: string | null;
  };
  verification: {
    checks: VerificationCheck[];
    verifiedAt: string;
    verifiedBy: string;
    reason?: string;
  } | null;
  history: KycHistoryEntry[];
}

export type KycSummary = Pick<
  KycRecord,
  "reference" | "msisdn" | "status" | "createdAt" | "updatedAt" | "wantsAirtelMoney"
> & { fullName: string; idType: IdType };
