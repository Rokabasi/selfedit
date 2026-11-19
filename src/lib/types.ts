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

/** Dossier KYC : un enregistrement (et un fichier JSON exportable) par numéro. */
export interface KycRecord {
  schemaVersion: 2;
  reference: string;
  msisdn: string;
  status: KycStatus;
  createdAt: string;
  updatedAt: string;
  /** Date à laquelle l'abonné a choisi (réservé) son numéro dans le parcours. */
  numberAssignedAt: string;
  /** @deprecated Ancien parcours avec OTP : présent uniquement sur les dossiers importés antérieurs. */
  otpVerifiedAt?: string;
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
    front: { dataUrl: string; meta: ScanMeta };
    back: { dataUrl: string; meta: ScanMeta } | null;
  };
  liveness: {
    method: "face-mesh" | "guided";
    selfie: string;
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
