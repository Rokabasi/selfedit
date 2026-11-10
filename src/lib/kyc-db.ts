import { normalizeMsisdn, isValidMsisdn } from "./phone";
import type { Submission } from "./schemas";
import type { KycRecord, KycStatus, VerificationCheck } from "./types";

/**
 * Stockage 100 % navigateur (aucune requête réseau) :
 * IndexedDB, un enregistrement par numéro, clé = msisdn (243XXXXXXXXX).
 * Chaque dossier peut être exporté / importé sous forme de fichier JSON <msisdn>.json.
 *
 * ⚠️ Les données restent dans le navigateur de l'appareil utilisé.
 */

const DB_NAME = "airtel-selfkyc";
const STORE = "records";

export class KycConflictError extends Error {
  constructor(public readonly status: KycStatus, public readonly reference: string) {
    super(
      status === "APPROVED"
        ? "Ce numéro est déjà identifié. Aucune action n'est nécessaire."
        : `Un dossier est déjà en cours de vérification (réf. ${reference}).`,
    );
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Stockage local indisponible sur ce navigateur"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "msisdn" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Ouverture du stockage local impossible"));
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("Erreur de stockage local"));
      tx.onabort = () => reject(tx.error ?? new Error("Écriture annulée (espace insuffisant ?)"));
    });
  } finally {
    db.close();
  }
}

/* -------------------------------- Lecture ---------------------------------- */

export async function getRecord(msisdn: string): Promise<KycRecord | null> {
  if (!isValidMsisdn(msisdn)) return null;
  return ((await run("readonly", (s) => s.get(msisdn))) as KycRecord | undefined) ?? null;
}

export async function listRecords(): Promise<KycRecord[]> {
  const all = (await run("readonly", (s) => s.getAll())) as KycRecord[];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------- Écriture --------------------------------- */

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function newReference(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `KYC-${date}-${rand.toUpperCase()}`;
}

/** Bloque un nouveau parcours si le numéro est déjà en cours ou approuvé. */
export async function assertCanStart(msisdn: string) {
  const existing = await getRecord(msisdn);
  if (existing && existing.status !== "REJECTED") throw new KycConflictError(existing.status, existing.reference);
}

export async function createRecord(s: Submission, otpVerifiedAt: string): Promise<KycRecord> {
  const existing = await getRecord(s.msisdn);
  if (existing && existing.status !== "REJECTED") throw new KycConflictError(existing.status, existing.reference);

  const now = new Date().toISOString();
  const p = s.personal;
  const record: KycRecord = {
    schemaVersion: 2,
    reference: newReference(),
    msisdn: s.msisdn,
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    otpVerifiedAt,
    wantsAirtelMoney: s.identity.wantsAirtelMoney,
    identity: { idType: s.identity.idType, idNumber: s.identity.idNumber.toUpperCase() },
    personal: {
      lastName: p.lastName.toUpperCase(),
      middleName: p.middleName.toUpperCase(),
      firstName: p.firstName,
      birthPlace: p.birthPlace,
      birthDate: p.birthDate,
      email: p.email.toLowerCase(),
      altPhones: [p.altPhone1, p.altPhone2].map((v) => normalizeMsisdn(v)).filter((v): v is string => v !== null),
      district: p.district,
      city: p.city,
      village: p.village,
      address: p.address,
    },
    sim: {
      iccid: s.sim.iccid,
      pukHash: await sha256(`${s.sim.iccid}:${s.sim.puk}`),
      pukHint: `${"*".repeat(Math.max(0, s.sim.puk.length - 2))}${s.sim.puk.slice(-2)}`,
    },
    documents: { front: s.documents.front, back: s.documents.back },
    liveness: {
      method: s.liveness.method,
      selfie: s.liveness.selfie,
      challenges: s.liveness.challenges,
      durationMs: Math.max(0, s.liveness.completedAt - s.liveness.startedAt),
    },
    consent: {
      version: s.consent.version,
      acceptedAt: now,
      terms: s.consent.terms,
      privacy: s.consent.privacy,
      biometrics: s.consent.biometrics,
      accuracy: s.consent.accuracy,
      airtelMoney: s.consent.airtelMoney,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
    verification: null,
    history: [...(existing?.history ?? []), { at: now, status: "PENDING", by: "abonné (self-KYC)", note: "Dossier soumis" }],
  };

  // Le dossier reste PENDING : la validation se fait depuis le back-office.
  await run("readwrite", (st) => st.put(record));
  return record;
}

export async function updateStatus(
  msisdn: string,
  update: { status: KycStatus; checks: VerificationCheck[]; by: string; reason?: string },
): Promise<KycRecord | null> {
  const record = await getRecord(msisdn);
  if (!record) return null;
  const now = new Date().toISOString();
  const next: KycRecord = {
    ...record,
    status: update.status,
    updatedAt: now,
    verification: { checks: update.checks, verifiedAt: now, verifiedBy: update.by, reason: update.reason },
    history: [...record.history, { at: now, status: update.status, by: update.by, note: update.reason }],
  };
  await run("readwrite", (st) => st.put(next));
  return next;
}

export async function deleteRecord(msisdn: string) {
  await run("readwrite", (st) => st.delete(msisdn));
}

/* ---------------------------- Fichiers JSON -------------------------------- */

/** Télécharge le dossier sous forme de fichier <msisdn>.json. */
export function exportRecord(record: KycRecord) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${record.msisdn}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isRecord(v: unknown): v is KycRecord {
  const r = v as Partial<KycRecord> | null;
  return Boolean(
    r && r.schemaVersion === 2 && typeof r.msisdn === "string" && isValidMsisdn(r.msisdn) &&
      ["PENDING", "APPROVED", "REJECTED"].includes(r.status as string) && r.documents?.front && r.liveness?.selfie,
  );
}

/** Importe un ou plusieurs fichiers <msisdn>.json. Retourne le nombre importé et les erreurs. */
export async function importFiles(files: FileList | File[]): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];
  for (const file of Array.from(files)) {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isRecord(data)) throw new Error("format non reconnu");
      await run("readwrite", (st) => st.put(data));
      imported++;
    } catch (err) {
      errors.push(`${file.name} : ${(err as Error).message}`);
    }
  }
  return { imported, errors };
}
