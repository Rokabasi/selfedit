"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert, Button, CheckboxCard, StatusBadge } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import { useZodForm } from "@/lib/client/use-zod-form";
import { CONSENT_VERSION, LIVENESS_CHALLENGES, getIdType } from "@/lib/constants";
import { formatMsisdn, normalizeMsisdn } from "@/lib/phone";
import { consentSchemaFor, type ConsentInput } from "@/lib/schemas";
import type { KycStatus } from "@/lib/types";
import { LegalText } from "../legal-text";
import { useKyc, type StepId } from "../kyc-store";
import { StepLayout } from "../step-layout";

/* ------------------------------ Consentement ------------------------------- */

export function ConsentStep() {
  const { state, dispatch, next, back } = useKyc();
  const wantsAM = state.identity.wantsAirtelMoney;
  const schema = useMemo(() => consentSchemaFor(wantsAM), [wantsAM]);
  const { values, errors, set, validate } = useZodForm<ConsentInput, unknown>(schema, state.consent);

  function submit() {
    if (!validate()) return;
    dispatch({ type: "consent", value: values });
    next();
  }

  return (
    <StepLayout title="Consentement" description="Lisez attentivement les conditions ci-dessous." onBack={back} onNext={submit} nextLabel="J'accepte">
      <div className="max-h-72 overflow-y-auto rounded-card border border-line bg-white p-4 sm:p-5" tabIndex={0} aria-label="Conditions légales">
        <LegalText wantsAirtelMoney={wantsAM} />
        <p className="mt-4 text-xs text-muted">Version {CONSENT_VERSION}</p>
      </div>
      <div className="space-y-2">
        <CheckboxCard checked={values.terms} onChange={(v) => set("terms", v)} error={errors.terms} title="J'accepte les conditions générales d'abonnement Airtel" />
        <CheckboxCard checked={values.privacy} onChange={(v) => set("privacy", v)} error={errors.privacy} title="J'accepte le traitement de mes données personnelles" description="Pour les finalités décrites ci-dessus." />
        <CheckboxCard checked={values.biometrics} onChange={(v) => set("biometrics", v)} error={errors.biometrics} title="Je consens à la vérification biométrique de mon visage" />
        {wantsAM && (
          <CheckboxCard checked={values.airtelMoney} onChange={(v) => set("airtelMoney", v)} error={errors.airtelMoney} title="J'accepte les conditions générales Airtel Money" />
        )}
        <CheckboxCard checked={values.accuracy} onChange={(v) => set("accuracy", v)} error={errors.accuracy} title="Je certifie sur l'honneur l'exactitude des informations fournies" description="Toute fausse déclaration peut entraîner la suspension de la ligne." />
      </div>
    </StepLayout>
  );
}

/* ------------------------------ Récapitulatif ------------------------------ */

export function ReviewStep() {
  const { state, dispatch, back, goTo } = useKyc();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string>; sessionExpired?: boolean } | null>(null);
  const p = state.personal;
  const idType = getIdType(state.identity.idType);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ reference: string; status: KycStatus; createdAt: string }>("/api/kyc", {
        token: state.token,
        body: {
          msisdn: state.msisdn,
          identity: state.identity,
          personal: state.personal,
          sim: state.sim,
          documents: state.documents,
          liveness: state.liveness,
          consent: { ...state.consent, version: CONSENT_VERSION },
        },
      });
      dispatch({ type: "result", value: res });
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, fields: err.fields, sessionExpired: err.status === 401 });
      } else {
        setError({ message: "Erreur inattendue. Réessayez." });
      }
    } finally {
      setLoading(false);
    }
  }

  const edit = (step: StepId) => goTo(step, { fromReview: true });
  const altPhones = [p.altPhone1, p.altPhone2].filter(Boolean).map((v) => formatMsisdn(normalizeMsisdn(v) ?? v));

  return (
    <StepLayout
      title="Vérifiez vos informations"
      description="Relisez attentivement avant de soumettre votre dossier."
      onBack={back}
      onNext={() => void submit()}
      nextLabel="Soumettre"
      loading={loading}
      asForm={false}
    >
      <ReviewCard title="Ligne" onEdit={undefined}>
        <Row label="Numéro" value={formatMsisdn(state.msisdn)} />
        <Row label="Airtel Money" value={state.identity.wantsAirtelMoney ? "Oui, ouvrir un compte" : "Non"} />
      </ReviewCard>

      <ReviewCard title="Pièce d'identité" onEdit={() => edit("identity")}>
        <Row label="Type" value={idType?.label} />
        <Row label="Numéro" value={state.identity.idNumber} mono />
      </ReviewCard>

      <ReviewCard title="Informations personnelles" onEdit={() => edit("personal")}>
        <Row label="Nom" value={p.lastName.toUpperCase()} />
        <Row label="Postnom" value={p.middleName ? p.middleName.toUpperCase() : "—"} />
        <Row label="Prénom" value={p.firstName} />
        <Row label="Né(e) le" value={p.birthDate ? new Date(p.birthDate).toLocaleDateString("fr-FR") : ""} />
        <Row label="À" value={p.birthPlace} />
        <Row label="Email" value={p.email || "—"} />
        <Row label="Autres numéros" value={altPhones.length ? altPhones.join(" · ") : "—"} />
        <Row label="Adresse" value={[p.address, p.village, p.city, `District ${p.district}`].filter(Boolean).join(", ")} />
      </ReviewCard>

      <ReviewCard title="Carte SIM" onEdit={() => edit("sim")}>
        <Row label="ICCID" value={state.sim.iccid.replace(/(\d{4})(?=\d)/g, "$1 ")} mono />
        <Row label="PUK" value={`••••••${state.sim.puk.slice(-2)}`} mono />
      </ReviewCard>

      <ReviewCard title="Documents & vérification" onEdit={() => edit("document")}>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {state.documents.front && <Thumb src={state.documents.front.dataUrl} label="Recto" />}
          {state.documents.back && <Thumb src={state.documents.back.dataUrl} label="Verso" />}
          {state.liveness && <Thumb src={state.liveness.selfie} label="Selfie" mirror />}
        </div>
        {state.liveness && (
          <p className="pt-2 text-xs font-semibold text-success">
            ✓ Preuve de vie : {state.liveness.challenges.map((c) => LIVENESS_CHALLENGES[c.type].short).join(", ")}
          </p>
        )}
        <button type="button" onClick={() => edit("liveness")} className="mt-1 text-xs font-bold text-airtel underline">
          Refaire la vérification du visage
        </button>
      </ReviewCard>

      {error && (
        <Alert tone="error" title="Soumission impossible">
          <p>{error.message}</p>
          {error.fields && (
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(error.fields).map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          )}
          {error.sessionExpired && (
            <button type="button" className="mt-2 font-bold underline" onClick={() => goTo("phone")}>
              Revalider mon numéro
            </button>
          )}
        </Alert>
      )}
    </StepLayout>
  );
}

function ReviewCard({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-extrabold tracking-wide text-airtel uppercase">{title}</h3>
        {onEdit && (
          <button type="button" onClick={onEdit} className="rounded-full px-3 py-1 text-sm font-bold text-airtel hover:bg-airtel-50">
            Modifier
          </button>
        )}
      </div>
      <dl className="divide-y divide-line">{children}</dl>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`text-right font-bold wrap-break-word ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Thumb({ src, label, mirror }: { src: string; label: string; mirror?: boolean }) {
  return (
    <figure className="space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="aspect-square w-full rounded-xl object-cover" style={mirror ? { transform: "scaleX(-1)" } : undefined} />
      <figcaption className="text-center text-xs font-bold text-muted">{label}</figcaption>
    </figure>
  );
}

/* -------------------------------- Terminé ---------------------------------- */

export function DoneStep() {
  const { state, reset } = useKyc();
  const result = state.result;
  if (!result) return null;

  return (
    <div className="animate-fade-up space-y-6 text-center">
      <div className="animate-pop-in mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success text-white shadow-lg">
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-black">Dossier soumis avec succès</h2>
        <p className="text-muted">
          Merci ! Votre identification est en cours de vérification. Vous recevrez un SMS au {formatMsisdn(state.msisdn)} dès
          qu&apos;elle sera validée.
        </p>
      </div>
      <div className="mx-auto max-w-sm space-y-3 rounded-card border border-line bg-white p-4 text-left text-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Référence</span>
          <span className="font-mono font-extrabold">{result.reference}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Statut</span>
          <StatusBadge status={result.status} />
        </div>
        {state.identity.wantsAirtelMoney && (
          <p className="rounded-xl bg-airtel-50 p-3 text-xs font-semibold text-airtel-dark">
            Votre compte Airtel Money sera activé après validation. Vous recevrez un SMS pour définir votre code PIN.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/statut?msisdn=${state.msisdn}`} className="inline-flex h-12 items-center justify-center rounded-full bg-airtel px-6 font-bold text-white hover:bg-airtel-dark">
          Suivre mon dossier
        </Link>
        <Button variant="ghost" onClick={reset}>Identifier une autre SIM</Button>
      </div>
    </div>
  );
}
