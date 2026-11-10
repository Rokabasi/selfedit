"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { LIVENESS_CHALLENGES, getIdType } from "@/lib/constants";
import { exportRecord, getRecord } from "@/lib/kyc-db";
import { formatMsisdn } from "@/lib/phone";
import { ageFrom } from "@/lib/schemas";
import type { KycRecord } from "@/lib/types";
import { VerifyPanel } from "./verify-panel";

export function RecordDetail({ msisdn }: { msisdn: string }) {
  const [record, setRecord] = useState<KycRecord | null | undefined>(undefined);

  useEffect(() => {
    getRecord(msisdn).then(setRecord).catch(() => setRecord(null));
  }, [msisdn]);

  if (record === undefined) return <main className="p-8 text-center text-sm text-muted">Chargement…</main>;
  if (record === null) {
    return (
      <main className="mx-auto max-w-5xl space-y-3 px-4 py-8">
        <Link href="/backoffice" className="text-sm font-bold text-airtel hover:underline">← Tous les dossiers</Link>
        <p className="rounded-card bg-white p-5 text-sm font-semibold">Aucun dossier KYC pour le {formatMsisdn(msisdn)} dans ce navigateur.</p>
      </main>
    );
  }

  const r = record;
  const p = r.personal;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link href="/backoffice" className="text-sm font-bold text-airtel hover:underline">← Tous les dossiers</Link>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card bg-white p-5">
        <div>
          <p className="font-mono text-xs font-bold text-muted">{r.reference}</p>
          <h1 className="text-xl font-black">{formatMsisdn(r.msisdn)}</h1>
          <p className="text-xs text-muted">
            {p.firstName} {p.lastName} {p.middleName} · soumis le {new Date(r.createdAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={r.status} />
          {r.wantsAirtelMoney && <p className="text-xs font-bold text-airtel">+ Ouverture Airtel Money</p>}
          <Button size="md" variant="secondary" onClick={() => exportRecord(r)}>Télécharger {r.msisdn}.json</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Pièces & biométrie">
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure src={r.documents.front.dataUrl} label="Recto" />
              {r.documents.back && <Figure src={r.documents.back.dataUrl} label="Verso" />}
              <Figure src={r.liveness.selfie} label="Selfie (liveness)" />
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
              ]}
            />
          </Card>

          <Card title="Historique">
            <ol className="space-y-2 text-sm">
              {r.history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={h.status} />
                  <span className="text-xs text-muted">{new Date(h.at).toLocaleString("fr-FR")}</span>
                  <span className="font-semibold">{h.by}</span>
                  {h.note && <span className="text-muted">— {h.note}</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <VerifyPanel key={r.updatedAt} record={r} onUpdated={setRecord} />
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="mb-3 text-xs font-extrabold tracking-wide text-airtel uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="font-bold break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Figure({ src, label }: { src: string; label: string }) {
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="aspect-4/3 w-full rounded-xl bg-surface object-cover ring-1 ring-line" />
      <figcaption className="text-center text-xs font-bold text-muted">{label}</figcaption>
    </figure>
  );
}
