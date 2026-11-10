export const OTP_LENGTH = 4;
/** Code OTP accepté (aucune passerelle SMS : vérification locale). */
export const OTP_CODE = "1234";
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 30;
export const MIN_AGE = 18;
export const CONSENT_VERSION = "CGU-SELFKYC-2026.11";

/** Préfixes mobiles Airtel RDC (format national sans le 0). */
export const AIRTEL_PREFIXES = ["97", "98", "99"] as const;

export const ID_TYPES = [
  { value: "CARTE_ELECTEUR", label: "Carte d'électeur", requiresBack: true },
  { value: "PASSEPORT", label: "Passeport", requiresBack: false },
  { value: "CARTE_MILITAIRE", label: "Carte militaire", requiresBack: true },
  { value: "CARTE_POLICE", label: "Carte de police", requiresBack: true },
  { value: "CARTE_ELEVE", label: "Carte d'élève", requiresBack: true },
  { value: "AUTRE", label: "Autres", requiresBack: true },
] as const;

export type IdType = (typeof ID_TYPES)[number]["value"];
export const ID_TYPE_VALUES = ID_TYPES.map((t) => t.value) as [IdType, ...IdType[]];
export const getIdType = (value: string | undefined) => ID_TYPES.find((t) => t.value === value);

export const LIVENESS_CHALLENGES = {
  TURN_LEFT: { label: "Tournez lentement la tête vers la gauche", short: "Tête à gauche", icon: "←" },
  TURN_RIGHT: { label: "Tournez lentement la tête vers la droite", short: "Tête à droite", icon: "→" },
  BLINK: { label: "Clignez des yeux", short: "Clignement", icon: "◉" },
  SMILE: { label: "Faites un grand sourire", short: "Sourire", icon: "☺" },
  OPEN_MOUTH: { label: "Ouvrez la bouche", short: "Bouche ouverte", icon: "○" },
} as const;

export type ChallengeType = keyof typeof LIVENESS_CHALLENGES;
export const CHALLENGE_TYPES = Object.keys(LIVENESS_CHALLENGES) as [ChallengeType, ...ChallengeType[]];
export const LIVENESS_CHALLENGE_COUNT = 3;

export const IMAGE_KINDS = ["id_front", "id_back", "selfie"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
