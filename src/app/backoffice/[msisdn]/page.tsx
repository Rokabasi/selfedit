import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifyPanel } from "@/components/backoffice/verify-panel";
import { AppHeader } from "@/components/ui/brand";
import { StatusBadge } from "@/components/ui/primitives";
import { LIVENESS_CHALLENGES, getIdType } from "@/lib/constants";
import { formatMsisdn, isValidMsisdn } from "@/lib/phone";
import { ageFrom } from "@/lib/schemas";
import { getRecord } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ msisdn: string }> }): Promise<Metadata> {
  const { msisdn } = await params;
  return { title: `Dossier ${formatMsisdn(msisdn)}` };
}

export default async function RecordPage({ params }: { params: Promise<{ msisdn: string }> }) {
  const { msisdn } = await params;
  if (!isValidMsisdn(msisdn)) notFound();
  const r = await getRecord(msisdn);
  if (!r) notFound();

  const p = r.personal;
  const img = (kind: string) => `/api/admin/kyc/${r.msisdn}/images/${kind}?v=${encodeURIComponent(r.updatedAt)}`;

  return (
    <>
      <AppHeader subtitle="Back-office KYC" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Link href="/backoffice" className="text-sm font-bold text-airtel hover:underline">← Tous les dossiers</Link>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-white p-5">
          <div>
            <p className="font-mono text-xs font-bold text-muted">{r.reference}</p>
            <h1 className="text-2xl font-black">{formatMsisdn(r.msisdn)}</h1>
            <p className="text-sm text-muted">
              {p.firstName} {p.lastName} {p.middleName} · soumis le {new Date(r.createdAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={r.status} />
            {r.wantsAirtelMoney && <p className="mt-2 text-xs font-bold text-airtel">+ Ouverture Airtel Money</p>}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card title="Pièces & biométrie">
              <div className="grid gap-3 sm:grid-cols-3">
                <Figure src={img("id_front")} label="Recto" />
                {r.documents.back && <Figure src={img("id_back")} label="Verso" />}
                <Figure src={img("selfie")} label="Selfie (liveness)" />
              </div>
              <p className="mt-3 text-xs text-muted">
                Liveness : {r.liveness.method === "face-mesh" ? "détection faciale" : "mode guidé"} ·{" "}
                {r.liveness.challenges.map((c) => LIVENESS_CHALLENGES[c.type].short).join(", ")} · {(r.liveness.durationMs / 1000).toFixed(1)} s
              </p>
            </Card>

            <Card title="Identité">
              <Grid
                rows={[
                  ["Nom", p.lastName],
                  ["Postnom", p.middleName || "—"],
                  ["Prénom", p.firstName],
                  ["Date de naissance", `${new Date(p.birthDate).toLocaleDateString("fr-FR")} (${ageFrom(p.birthDate)} ans)`],
                  ["Lieu de naissance", p.birthPlace],
                  ["Pièce", getIdType(r.identity.idType)?.label ?? r.identity.idType],
                  ["N° de pièce", r.identity.idNumber],
                ]}
              />
            </Card>

            <Card title="Contact & adresse">
              <Grid
                rows={[
                  ["Email", p.email || "—"],
                  ["Autres numéros", p.altPhones.length ? p.altPhones.map(formatMsisdn).join(", ") : "—"],
                  ["District", p.district],
                  ["Ville", p.city],
                  ["Village / quartier", p.village],
                  ["Adresse", p.address],
                ]}
              />
            </Card>

            <Card title="SIM & consentement">
              <Grid
                rows={[
                  ["ICCID", r.sim.iccid],
                  ["PUK", `${r.sim.pukHint} (haché SHA-256)`],
                  ["Consentement", `${r.consent.version} — ${new Date(r.consent.acceptedAt).toLocaleString("fr-FR")}`],
                  ["IP", r.consent.ip ?? "—"],
                ]}
              />
            </Card>

            <Card title="Historique">
              <ol className="space-y-2 text-sm">
                {r.history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={h.status} />
                    <span className="text-muted">{new Date(h.at).toLocaleString("fr-FR")}</span>
                    <span className="font-semibold">{h.by}</span>
                    {h.note && <span className="text-muted">— {h.note}</span>}
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <VerifyPanel msisdn={r.msisdn} status={r.status} initialChecks={r.verification?.checks ?? null} />
        </div>
      </main>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-3 text-sm font-extrabold tracking-wide text-airtel uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted">{k}</dt>
          <dd className="font-bold break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Figure({ src, label }: { src: string; label: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="group block space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="aspect-4/3 w-full rounded-xl bg-surface object-cover ring-1 ring-line transition group-hover:ring-airtel" />
      <span className="block text-center text-xs font-bold text-muted">{label}</span>
    </a>
  );
}
