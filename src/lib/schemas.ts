import { z } from "zod";
import {
  CHALLENGE_TYPES,
  CONSENT_VERSION,
  ID_TYPE_VALUES,
  LIVENESS_CHALLENGE_COUNT,
  MIN_AGE,
  getIdType,
} from "./constants";
import { normalizeMsisdn } from "./phone";

/* ----------------------------------------------------------------------------
 * Schémas partagés client / serveur. Le client valide chaque étape,
 * le serveur revalide l'intégralité du dossier à la soumission.
 * -------------------------------------------------------------------------- */

export function ageFrom(isoDate: string, now = new Date()): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return Number.NaN;
  let age = now.getFullYear() - y;
  const month = now.getMonth() + 1;
  if (month < m || (month === m && now.getDate() < d)) age--;
  return age;
}

const NAME_RE = /^\p{L}[\p{L}' .-]*$/u;

const requiredText = (label: string, max = 60) =>
  z.string().trim().min(1, `${label} est obligatoire`).max(max, `${label} est trop long (${max} max.)`);

const nameField = (label: string) =>
  requiredText(label, 50).regex(NAME_RE, `${label} contient des caractères non autorisés`);

const otherPhone = z
  .string()
  .trim()
  .min(1, "Ce numéro est obligatoire")
  .refine((v) => v === "" || normalizeMsisdn(v) !== null, "Numéro RDC invalide (ex. 0991234567)");

/* ---------------------------------- Étapes --------------------------------- */

export const identitySchema = z.object({
  wantsAirtelMoney: z.boolean(),
  idType: z.enum(ID_TYPE_VALUES, { errorMap: () => ({ message: "Choisissez le type de pièce d'identité" }) }),
  idNumber: z
    .string()
    .trim()
    .min(4, "Le numéro de la pièce est trop court")
    .max(30, "Le numéro de la pièce est trop long")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 /-]*$/, "Seuls les lettres, chiffres, espaces, / et - sont autorisés"),
});

export const personalSchema = z
  .object({
    lastName: nameField("Le nom"),
    middleName: z
      .string()
      .trim()
      .max(50, "Le postnom est trop long")
      .refine((v) => v === "" || NAME_RE.test(v), "Le postnom contient des caractères non autorisés"),
    firstName: nameField("Le prénom"),
    birthPlace: requiredText("Le lieu de naissance", 80),
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La date de naissance est obligatoire")
      .refine((v) => ageFrom(v) >= 0 && ageFrom(v) <= 120, "Date de naissance invalide")
      .refine((v) => ageFrom(v) >= MIN_AGE, `Vous devez avoir au moins ${MIN_AGE} ans`),
    email: z
      .string()
      .trim()
      .max(120)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Adresse email invalide"),
    altPhone1: otherPhone,
    altPhone2: otherPhone,
    district: requiredText("Le district"),
    city: requiredText("La ville"),
    village: requiredText("Le village / quartier"),
    address: requiredText("L'adresse", 160),
  })
  .superRefine((v, ctx) => {
    if (v.altPhone1 && v.altPhone2 && normalizeMsisdn(v.altPhone1) === normalizeMsisdn(v.altPhone2)) {
      ctx.addIssue({ code: "custom", path: ["altPhone2"], message: "Les deux numéros sont identiques" });
    }
  });

export const simSchema = z.object({
  iccid: z.string().regex(/^89\d{17,18}$/, "L'ICCID contient 19 ou 20 chiffres et commence par 89"),
  puk: z.string().regex(/^\d{4,8}$/, "Le code PUK contient au moins 4 chiffres (8 maximum)"),
});

const MAX_IMAGE_CHARS = 8_000_000; // ~6 Mo binaires
export const dataUrlSchema = z
  .string()
  .max(MAX_IMAGE_CHARS, "Image trop volumineuse")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Format d'image invalide");

export const scanMetaSchema = z.object({
  source: z.enum(["camera", "upload"]),
  brightness: z.number().min(0).max(255),
  sharpness: z.number().min(0),
  glare: z.number().min(0).max(1),
  qualityOk: z.boolean(),
});

export const capturedDocumentSchema = z.object({ dataUrl: dataUrlSchema, meta: scanMetaSchema });

export const documentsSchema = z.object({
  front: capturedDocumentSchema,
  back: capturedDocumentSchema.nullable(),
});

export const livenessSchema = z.object({
  method: z.enum(["face-mesh", "guided"]),
  selfie: dataUrlSchema,
  challenges: z
    .array(z.object({ type: z.enum(CHALLENGE_TYPES), completedAt: z.number() }))
    .min(LIVENESS_CHALLENGE_COUNT)
    .max(CHALLENGE_TYPES.length),
  startedAt: z.number(),
  completedAt: z.number(),
});

const mustAccept = (message: string) => z.boolean().refine((v) => v, message);

export const consentSchemaFor = (wantsAirtelMoney: boolean) =>
  z.object({
    terms: mustAccept("Vous devez accepter les conditions générales"),
    privacy: mustAccept("Vous devez accepter le traitement de vos données"),
    biometrics: mustAccept("Vous devez consentir à la vérification biométrique"),
    accuracy: mustAccept("Vous devez certifier l'exactitude des informations"),
    airtelMoney: wantsAirtelMoney
      ? mustAccept("Vous devez accepter les conditions Airtel Money")
      : z.boolean(),
  });

/* ------------------------------ Soumission --------------------------------- */

export const submissionSchema = z
  .object({
    msisdn: z.string().regex(/^243\d{9}$/),
    identity: identitySchema,
    personal: personalSchema,
    sim: simSchema,
    documents: documentsSchema,
    liveness: livenessSchema,
    consent: consentSchemaFor(false).extend({ version: z.literal(CONSENT_VERSION) }),
  })
  .superRefine((s, ctx) => {
    if (getIdType(s.identity.idType)?.requiresBack && !s.documents.back) {
      ctx.addIssue({ code: "custom", path: ["documents", "back"], message: "Le verso de la pièce est obligatoire" });
    }
    if (s.identity.wantsAirtelMoney && !s.consent.airtelMoney) {
      ctx.addIssue({ code: "custom", path: ["consent", "airtelMoney"], message: "Conditions Airtel Money non acceptées" });
    }
    for (const key of ["altPhone1", "altPhone2"] as const) {
      const v = s.personal[key];
      if (v && normalizeMsisdn(v) === s.msisdn) {
        ctx.addIssue({ code: "custom", path: ["personal", key], message: "Le numéro secondaire doit être différent" });
      }
    }
  });

export type IdentityInput = z.input<typeof identitySchema>;
export type PersonalInput = z.input<typeof personalSchema>;
export type SimInput = z.input<typeof simSchema>;
export type ScanMeta = z.infer<typeof scanMetaSchema>;
export type CapturedDocument = z.infer<typeof capturedDocumentSchema>;
export type LivenessResult = z.infer<typeof livenessSchema>;
export type ConsentInput = z.input<ReturnType<typeof consentSchemaFor>>;
export type Submission = z.infer<typeof submissionSchema>;

/** Convertit une ZodError en dictionnaire { "chemin.du.champ": "message" } (1er message par champ). */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
