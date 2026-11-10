import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { IMAGE_KINDS, type ImageKind } from "@/lib/constants";
import { normalizeMsisdn, isValidMsisdn } from "@/lib/phone";
import type { Submission } from "@/lib/schemas";
import type { KycRecord, KycStatus, KycSummary, VerificationCheck } from "@/lib/types";

/**
 * Référentiel KYC sur système de fichiers (pas de base de données) :
 *
 *   data/kyc/
 *     243991234567.json          ← dossier KYC (1 fichier par numéro)
 *     243991234567/
 *       id_front.jpg | id_back.jpg | selfie.jpg
 *
 * Les écritures sont atomiques (fichier temporaire + rename) et sérialisées
 * par numéro pour éviter les soumissions concurrentes.
 */

export const DATA_DIR = path.resolve(process.env.KYC_DATA_DIR ?? path.join(process.cwd(), "data", "kyc"));

export class KycConflictError extends Error {
  constructor(public readonly status: KycStatus) {
    super(`Un dossier KYC existe déjà pour ce numéro (statut ${status})`);
  }
}

function assertMsisdn(msisdn: string) {
  // Garde-fou anti path-traversal : le msisdn sert de nom de fichier.
  if (!isValidMsisdn(msisdn)) throw new Error("MSISDN invalide");
}

const recordPath = (msisdn: string) => path.join(DATA_DIR, `${msisdn}.json`);
const mediaDir = (msisdn: string) => path.join(DATA_DIR, msisdn);

/* ----------------------------- Verrou par numéro --------------------------- */

const g = globalThis as unknown as { __kycLocks?: Map<string, Promise<unknown>> };
const locks = (g.__kycLocks ??= new Map());

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  locks.set(key, run);
  try {
    return await run;
  } finally {
    if (locks.get(key) === run) locks.delete(key);
  }
}

/* --------------------------------- I/O ------------------------------------- */

async function writeAtomic(file: string, data: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Image invalide");
  return { buffer: Buffer.from(m[2]!, "base64"), ext: m[1] === "jpeg" ? "jpg" : m[1]! };
}

async function saveImage(msisdn: string, kind: ImageKind, dataUrl: string): Promise<string> {
  const { buffer, ext } = decodeDataUrl(dataUrl);
  const file = `${kind}.${ext}`;
  await writeAtomic(path.join(mediaDir(msisdn), file), buffer);
  return file;
}

/* ------------------------------- Lecture ----------------------------------- */

export async function getRecord(msisdn: string): Promise<KycRecord | null> {
  assertMsisdn(msisdn);
  try {
    return JSON.parse(await fs.readFile(recordPath(msisdn), "utf8")) as KycRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listRecords(): Promise<KycSummary[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }
  const records = await Promise.all(
    entries
      .filter((f) => /^243\d{9}\.json$/.test(f))
      .map((f) => getRecord(f.slice(0, -5)).catch(() => null)),
  );
  return records
    .filter((r): r is KycRecord => r !== null)
    .map((r) => ({
      reference: r.reference,
      msisdn: r.msisdn,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      wantsAirtelMoney: r.wantsAirtelMoney,
      idType: r.identity.idType,
      fullName: [r.personal.firstName, r.personal.lastName, r.personal.middleName].filter(Boolean).join(" "),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function readImage(msisdn: string, kind: ImageKind) {
  assertMsisdn(msisdn);
  if (!IMAGE_KINDS.includes(kind)) return null;
  const record = await getRecord(msisdn);
  if (!record) return null;
  const file =
    kind === "selfie"
      ? record.liveness.selfieFile
      : kind === "id_front"
        ? record.documents.front.file
        : record.documents.back?.file;
  if (!file) return null;
  const buffer = await fs.readFile(path.join(mediaDir(msisdn), path.basename(file)));
  const ext = path.extname(file).slice(1);
  return { buffer, contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}` };
}

/* ------------------------------- Écriture ---------------------------------- */

function newReference(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `KYC-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createRecord(
  s: Submission,
  ctx: { ip: string | null; userAgent: string | null },
): Promise<KycRecord> {
  assertMsisdn(s.msisdn);
  return withLock(s.msisdn, async () => {
    const existing = await getRecord(s.msisdn);
    // Un dossier rejeté peut être resoumis ; un dossier en cours ou approuvé non.
    if (existing && existing.status !== "REJECTED") throw new KycConflictError(existing.status);

    const [front, back, selfie] = await Promise.all([
      saveImage(s.msisdn, "id_front", s.documents.front.dataUrl),
      s.documents.back ? saveImage(s.msisdn, "id_back", s.documents.back.dataUrl) : Promise.resolve(null),
      saveImage(s.msisdn, "selfie", s.liveness.selfie),
    ]);

    const now = new Date().toISOString();
    const p = s.personal;
    const record: KycRecord = {
      schemaVersion: 1,
      reference: newReference(),
      msisdn: s.msisdn,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
      otpVerifiedAt: now,
      wantsAirtelMoney: s.identity.wantsAirtelMoney,
      identity: { idType: s.identity.idType, idNumber: s.identity.idNumber.toUpperCase() },
      personal: {
        lastName: p.lastName.toUpperCase(),
        middleName: p.middleName.toUpperCase(),
        firstName: p.firstName,
        birthPlace: p.birthPlace,
        birthDate: p.birthDate,
        email: p.email.toLowerCase(),
        altPhones: [p.altPhone1, p.altPhone2]
          .map((v) => (v ? normalizeMsisdn(v) : null))
          .filter((v): v is string => v !== null),
        district: p.district,
        city: p.city,
        village: p.village,
        address: p.address,
      },
      sim: {
        iccid: s.sim.iccid,
        pukHash: sha256(`${s.sim.iccid}:${s.sim.puk}`),
        pukHint: `******${s.sim.puk.slice(-2)}`,
      },
      documents: {
        front: { file: front, meta: s.documents.front.meta },
        back: back && s.documents.back ? { file: back, meta: s.documents.back.meta } : null,
      },
      liveness: {
        method: s.liveness.method,
        selfieFile: selfie,
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
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      verification: null,
      history: [
        ...(existing?.history ?? []),
        { at: now, status: "PENDING", by: "abonné (self-KYC)", note: "Dossier soumis" },
      ],
    };

    await writeAtomic(recordPath(s.msisdn), JSON.stringify(record, null, 2));
    return record;
  });
}

export async function updateStatus(
  msisdn: string,
  update: { status: KycStatus; checks: VerificationCheck[]; by: string; reason?: string },
): Promise<KycRecord | null> {
  assertMsisdn(msisdn);
  return withLock(msisdn, async () => {
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
    await writeAtomic(recordPath(msisdn), JSON.stringify(next, null, 2));
    return next;
  });
}
