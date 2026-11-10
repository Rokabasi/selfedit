"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, StatusBadge } from "@/components/ui/primitives";
import { getIdType } from "@/lib/constants";
import { exportRecord, importFiles, listRecords } from "@/lib/kyc-db";
import { formatMsisdn, normalizeMsisdn } from "@/lib/phone";
import type { KycRecord, KycStatus } from "@/lib/types";

const FILTERS: { value: KycStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Approuvés" },
  { value: "REJECTED", label: "Rejetés" },
];

const fullName = (r: KycRecord) => [r.personal.firstName, r.personal.lastName, r.personal.middleName].filter(Boolean).join(" ");

export function RecordList() {
  const [records, setRecords] = useState<KycRecord[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<KycStatus | "ALL">("ALL");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await listRecords());
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const msisdnQuery = normalizeMsisdn(q);
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return (records ?? []).filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!query) return true;
      return (
        r.msisdn === msisdnQuery ||
        (digits.length >= 3 && r.msisdn.includes(digits)) ||
        r.reference.toLowerCase().includes(query) ||
        fullName(r).toLowerCase().includes(query)
      );
    });
  }, [records, q, status, msisdnQuery]);

  const count = (s: KycStatus) => (records ?? []).filter((r) => r.status === s).length;

  async function onImport(files: FileList | null) {
    if (!files?.length) return;
    const { imported, errors } = await importFiles(files);
    setNotice(errors.length ? { tone: "error", text: `${imported} importé(s). Erreurs : ${errors.join(" ; ")}` } : { tone: "success", text: `${imported} dossier(s) importé(s).` });
    await load();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">Dossiers d&apos;identification</h1>
          <p className="text-xs text-muted">Stockés dans ce navigateur · un fichier JSON par numéro (export / import).</p>
        </div>
        <div className="flex gap-2">
          <Button size="md" variant="secondary" onClick={() => fileRef.current?.click()}>Importer des fichiers</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" multiple className="hidden" onChange={(e) => { void onImport(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={records?.length ?? 0} />
        <Stat label="En attente" value={count("PENDING")} tone="text-warning" />
        <Stat label="Approuvés" value={count("APPROVED")} tone="text-success" />
        <Stat label="Rejetés" value={count("REJECTED")} tone="text-airtel" />
      </div>

      <div className="flex flex-col gap-2 rounded-card bg-white p-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Numéro (099…), référence ou nom"
          className="h-10 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-airtel"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as KycStatus | "ALL")} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-airtel">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {msisdnQuery && records && !records.some((r) => r.msisdn === msisdnQuery) && (
        <p className="rounded-card bg-white p-3 text-sm font-semibold">Aucun dossier KYC pour le {formatMsisdn(msisdnQuery)}.</p>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs font-extrabold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Numéro</th>
                <th className="px-4 py-2.5">Titulaire</th>
                <th className="px-4 py-2.5">Pièce</th>
                <th className="px-4 py-2.5">Soumis le</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {records === null && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Chargement…</td></tr>
              )}
              {records !== null && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Aucun dossier.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.msisdn} className="hover:bg-surface/60">
                  <td className="px-4 py-2.5 font-mono font-bold whitespace-nowrap">{formatMsisdn(r.msisdn)}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold">{fullName(r)}</span>
                    {r.wantsAirtelMoney && <span className="ml-2 rounded bg-airtel px-1.5 py-0.5 text-[10px] font-black text-white">MONEY</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{getIdType(r.identity.idType)?.label ?? r.identity.idType}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => exportRecord(r)} className="mr-3 text-xs font-bold text-muted hover:text-ink">JSON</button>
                    <Link href={`/backoffice/${r.msisdn}`} className="font-bold text-airtel hover:underline">Ouvrir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card bg-white p-3">
      <p className="text-xs font-bold text-muted uppercase">{label}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
