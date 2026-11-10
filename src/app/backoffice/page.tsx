import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/ui/brand";
import { StatusBadge } from "@/components/ui/primitives";
import { getIdType } from "@/lib/constants";
import { formatMsisdn, normalizeMsisdn } from "@/lib/phone";
import { listRecords } from "@/lib/server/storage";
import type { KycStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Back-office KYC" };
export const dynamic = "force-dynamic";

const FILTERS: { value: KycStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Approuvés" },
  { value: "REJECTED", label: "Rejetés" },
];

export default async function BackofficePage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "ALL" } = await searchParams;
  const all = await listRecords();

  const query = q.trim().toLowerCase();
  const msisdnQuery = normalizeMsisdn(q);
  const rows = all.filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (!query) return true;
    return (
      (msisdnQuery && r.msisdn === msisdnQuery) ||
      r.msisdn.includes(query.replace(/\D/g, "") || "∅") ||
      r.reference.toLowerCase().includes(query) ||
      r.fullName.toLowerCase().includes(query)
    );
  });

  const counts = {
    total: all.length,
    PENDING: all.filter((r) => r.status === "PENDING").length,
    APPROVED: all.filter((r) => r.status === "APPROVED").length,
    REJECTED: all.filter((r) => r.status === "REJECTED").length,
  };

  // Recherche exacte d'un numéro existant → ouverture directe du dossier.
  const exact = msisdnQuery ? all.find((r) => r.msisdn === msisdnQuery) : undefined;

  return (
    <>
      <AppHeader subtitle="Back-office KYC" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Dossiers d&apos;identification</h1>
            <p className="text-sm text-muted">Un fichier JSON par numéro dans le dossier de stockage.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={counts.total} />
          <Stat label="En attente" value={counts.PENDING} tone="text-warning" />
          <Stat label="Approuvés" value={counts.APPROVED} tone="text-success" />
          <Stat label="Rejetés" value={counts.REJECTED} tone="text-airtel" />
        </div>

        <form className="flex flex-col gap-3 rounded-card bg-white p-4 sm:flex-row" action="/backoffice">
          <input
            name="q"
            defaultValue={q}
            placeholder="Numéro (099…), référence ou nom"
            className="h-12 flex-1 rounded-xl border-2 border-line px-4 outline-none focus:border-airtel"
          />
          <select name="status" defaultValue={status} className="h-12 rounded-xl border-2 border-line bg-white px-4 font-semibold outline-none focus:border-airtel">
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button className="h-12 rounded-full bg-airtel px-6 font-bold text-white hover:bg-airtel-dark">Rechercher</button>
        </form>

        {exact && (
          <Link href={`/backoffice/${exact.msisdn}`} className="flex items-center justify-between rounded-card border-2 border-airtel bg-airtel-50 p-4 font-bold">
            <span>Dossier trouvé : {formatMsisdn(exact.msisdn)} — {exact.fullName}</span>
            <StatusBadge status={exact.status} />
          </Link>
        )}
        {msisdnQuery && !exact && (
          <p className="rounded-card bg-white p-4 text-sm font-semibold">Aucun dossier KYC pour le {formatMsisdn(msisdnQuery)}.</p>
        )}

        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs font-extrabold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Numéro</th>
                  <th className="px-4 py-3">Titulaire</th>
                  <th className="px-4 py-3">Pièce</th>
                  <th className="px-4 py-3">Soumis le</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">Aucun dossier.</td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.msisdn} className="hover:bg-surface/60">
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">{formatMsisdn(r.msisdn)}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold">{r.fullName}</span>
                      {r.wantsAirtelMoney && <span className="ml-2 rounded bg-airtel px-1.5 py-0.5 text-[10px] font-black text-white">MONEY</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{getIdType(r.idType)?.label}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/backoffice/${r.msisdn}`} className="font-bold text-airtel hover:underline">Ouvrir →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-card bg-white p-4">
      <p className="text-xs font-bold text-muted uppercase">{label}</p>
      <p className={`text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}
