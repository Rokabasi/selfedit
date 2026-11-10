"use client";

import { useState } from "react";
import { CheckboxCard, Field, Input, Select } from "@/components/ui/primitives";
import { useZodForm } from "@/lib/client/use-zod-form";
import { ID_TYPES } from "@/lib/constants";
import { identitySchema, personalSchema, simSchema, type PersonalInput } from "@/lib/schemas";
import { useKyc, type IdentityForm } from "../kyc-store";
import { StepLayout } from "../step-layout";

/* ----------------------------- Étape 1 : pièce ----------------------------- */

export function IdentityStep() {
  const { state, dispatch, next, back } = useKyc();
  const { values, errors, set, validate } = useZodForm<IdentityForm, unknown>(identitySchema, state.identity);

  function submit() {
    if (!validate()) return;
    dispatch({ type: "identity", value: { ...values, idNumber: values.idNumber.trim().toUpperCase() } });
    next();
  }

  return (
    <StepLayout title="Votre pièce d'identité" description="Choisissez la pièce que vous allez scanner." onBack={back} onNext={submit}>
      <CheckboxCard
        checked={values.wantsAirtelMoney}
        onChange={(v) => set("wantsAirtelMoney", v)}
        icon={<span className="rounded-md bg-airtel px-1.5 py-0.5 text-[11px] font-black text-white">money</span>}
        title="Ouvrir aussi mon compte Airtel Money"
        description="Envoyez, recevez de l'argent et payez vos factures avec le même dossier d'identification."
      />

      <Field label="Type de pièce d'identité" error={errors.idType}>
        {(p) => (
          <Select {...p} value={values.idType} onChange={(e) => set("idType", e.target.value as IdentityForm["idType"])}>
            <option value="" disabled>
              Sélectionnez une pièce
            </option>
            {ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Numéro de la pièce d'identité" error={errors.idNumber} hint="Tel qu'il figure sur le document.">
        {(p) => (
          <Input {...p} value={values.idNumber} onChange={(e) => set("idNumber", e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="Ex. 1234567890" />
        )}
      </Field>
    </StepLayout>
  );
}

/* ---------------------- Étape 2 : informations personnelles ---------------- */

export function PersonalStep() {
  const { state, dispatch, next, back } = useKyc();
  const { values, errors, set, validate } = useZodForm<PersonalInput, unknown>(personalSchema, state.personal);

  function submit() {
    if (!validate()) return;
    dispatch({ type: "personal", value: values });
    next();
  }

  const text = (key: keyof PersonalInput, label: string, opts: { optional?: boolean; placeholder?: string; autoComplete?: string; type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; hint?: string; className?: string } = {}) => (
    <Field label={label} error={errors[key]} optional={opts.optional} hint={opts.hint} className={opts.className}>
      {(p) => (
        <Input
          {...p}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete ?? "off"}
          placeholder={opts.placeholder}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <StepLayout title="Informations personnelles" description="Renseignez vos informations exactement comme sur votre pièce d'identité." onBack={back} onNext={submit}>
      <Section title="Identité">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("lastName", "Nom", { autoComplete: "family-name", placeholder: "Ex. MUKENDI" })}
          {text("middleName", "Postnom", { optional: true, autoComplete: "additional-name", placeholder: "Ex. KABONGO" })}
          {text("firstName", "Prénom", { autoComplete: "given-name", placeholder: "Ex. Grâce" })}
          {text("birthPlace", "Lieu de naissance", { placeholder: "Ex. Kinshasa" })}
          {text("birthDate", "Date de naissance", { type: "date", autoComplete: "bday", className: "sm:col-span-2" })}
        </div>
      </Section>

      <Section title="Contacts">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("email", "Adresse email", { optional: true, type: "email", inputMode: "email", autoComplete: "email", placeholder: "nom@exemple.com", className: "sm:col-span-2" })}
          {text("altPhone1", "Autre numéro de téléphone 1", { type: "tel", inputMode: "tel", placeholder: "081 234 5678" })}
          {text("altPhone2", "Autre numéro de téléphone 2", { type: "tel", inputMode: "tel", placeholder: "085 234 5678" })}
        </div>
      </Section>

      <Section title="Adresse de résidence">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("district", "District", { placeholder: "Ex. Lukunga" })}
          {text("city", "Ville", { autoComplete: "address-level2", placeholder: "Ex. Kinshasa" })}
          {text("village", "Village / Quartier", { placeholder: "Ex. Gombe" })}
          {text("address", "Adresse", { autoComplete: "street-address", placeholder: "N°, avenue, référence" })}
        </div>
      </Section>
    </StepLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-card border border-line bg-white p-4 sm:p-5">
      <h3 className="text-sm font-extrabold tracking-wide text-airtel uppercase">{title}</h3>
      {children}
    </section>
  );
}

/* ------------------------------ Étape 3 : SIM ------------------------------ */

export function SimStep() {
  const { state, dispatch, next, back } = useKyc();
  const { values, errors, set, validate } = useZodForm(simSchema, state.sim);
  const [showPuk, setShowPuk] = useState(false);

  function submit() {
    if (!validate()) return;
    dispatch({ type: "sim", value: values });
    next();
  }

  const groupedIccid = values.iccid.replace(/(\d{4})(?=\d)/g, "$1 ");

  return (
    <StepLayout title="Votre carte SIM" description="Ces codes sont imprimés sur le support plastique de votre carte SIM." onBack={back} onNext={submit}>
      <SimCardIllustration iccid={groupedIccid} />

      <Field label="ICCID (numéro de série de la SIM)" error={errors.iccid} hint="19 ou 20 chiffres commençant par 89.">
        {(p) => (
          <Input
            {...p}
            inputMode="numeric"
            autoComplete="off"
            placeholder="8924 3xxx xxxx xxxx xxxx"
            value={groupedIccid}
            onChange={(e) => set("iccid", e.target.value.replace(/\D/g, "").slice(0, 20))}
            className="font-mono tracking-wider"
          />
        )}
      </Field>

      <Field label="Code PUK" error={errors.puk} hint="4 à 8 chiffres. Il n'est jamais conservé en clair.">
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              type={showPuk ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••••••"
              value={values.puk}
              onChange={(e) => set("puk", e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="pr-24 font-mono tracking-[0.3em]"
            />
            <button type="button" onClick={() => setShowPuk((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-airtel hover:bg-airtel-50">
              {showPuk ? "Masquer" : "Afficher"}
            </button>
          </div>
        )}
      </Field>
    </StepLayout>
  );
}

function SimCardIllustration({ iccid }: { iccid: string }) {
  return (
    <div className="relative overflow-hidden rounded-card bg-linear-to-br from-airtel to-airtel-dark p-5 text-white shadow-lg" aria-hidden>
      <div className="flex items-start justify-between">
        <span className="text-2xl font-black">airtel</span>
        <span className="h-10 w-12 rounded-md bg-linear-to-br from-yellow-200 to-yellow-500 shadow-inner" />
      </div>
      <div className="mt-6 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/15 px-3 py-2">
          <span className="font-bold opacity-80">ICCID</span>
          <span className="truncate font-mono">{iccid || "8924 3XXX XXXX XXXX XXXX"}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2">
          <span className="font-bold opacity-80">PIN / PUK</span>
          <span className="font-mono">0000 / ••••••••</span>
        </div>
      </div>
    </div>
  );
}
