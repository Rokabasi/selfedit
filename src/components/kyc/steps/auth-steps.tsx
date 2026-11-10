"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Field, Input, cx } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import { OTP_LENGTH, OTP_RESEND_SECONDS } from "@/lib/constants";
import { formatMsisdn, isAirtelMsisdn, normalizeMsisdn } from "@/lib/phone";
import { useKyc } from "../kyc-store";
import { StepLayout } from "../step-layout";

/* ------------------------------ Numéro ------------------------------------- */

export function PhoneStep() {
  const { state, dispatch, next } = useKyc();
  const [value, setValue] = useState(state.msisdn ? `0${state.msisdn.slice(3)}` : "");
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<{ title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setBlocking(null);
    const msisdn = normalizeMsisdn(value);
    if (!msisdn) return setError("Saisissez un numéro valide, ex. 099 123 4567");
    if (!isAirtelMsisdn(msisdn)) return setError("Ce numéro n'est pas un numéro Airtel (097, 098 ou 099)");

    setLoading(true);
    try {
      await api("/api/otp/send", { body: { msisdn } });
      dispatch({ type: "msisdn", msisdn });
      next();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBlocking({ title: err.code === "ALREADY_APPROVED" ? "Numéro déjà identifié" : "Dossier en cours", message: err.message });
      } else {
        setError(err instanceof Error ? err.message : "Erreur inattendue");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepLayout
      title="Identifiez votre SIM"
      description="Insérez votre nouvelle carte SIM Airtel dans ce téléphone, puis saisissez son numéro."
      onNext={submit}
      nextLabel="Recevoir le code"
      loading={loading}
    >
      <Field label="Numéro Airtel" error={error ?? undefined} hint="Le code de vérification sera envoyé par SMS à ce numéro.">
        {(p) => (
          <div className="flex gap-2">
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-bold">
              <span aria-hidden>🇨🇩</span> +243
            </span>
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="099 123 4567"
              value={value}
              onChange={(e) => {
                setValue(e.target.value.replace(/[^\d +]/g, ""));
                setError(null);
              }}
              maxLength={16}
              autoFocus
            />
          </div>
        )}
      </Field>
      {blocking && (
        <Alert tone="warning" title={blocking.title}>
          {blocking.message}{" "}
          <a className="font-bold underline" href={`/statut?msisdn=${normalizeMsisdn(value) ?? ""}`}>Consulter le statut</a>
        </Alert>
      )}
    </StepLayout>
  );
}

/* -------------------------------- OTP -------------------------------------- */

export function OtpStep() {
  const { state, dispatch, next, back } = useKyc();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(OTP_RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(code: string) {
    if (code.length !== OTP_LENGTH) return setError(`Saisissez les ${OTP_LENGTH} chiffres du code`);
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ token: string; expiresAt: number }>("/api/otp/verify", { body: { msisdn: state.msisdn, code } });
      dispatch({ type: "session", msisdn: state.msisdn, token: res.token, expiresAt: res.expiresAt });
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function update(index: number, raw: string) {
    const chars = raw.replace(/\D/g, "").split("");
    if (chars.length === 0) {
      setDigits((d) => d.map((v, i) => (i === index ? "" : v)));
      return;
    }
    // Gère la saisie simple comme le collage / l'autocomplétion SMS.
    const nextDigits = [...digits];
    chars.slice(0, OTP_LENGTH - index).forEach((c, k) => (nextDigits[index + k] = c));
    setDigits(nextDigits);
    setError(null);
    const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
    inputs.current[focusIdx]?.focus();
    if (nextDigits.every(Boolean)) void verify(nextDigits.join(""));
  }

  async function resend() {
    setResent(false);
    try {
      await api("/api/otp/send", { body: { msisdn: state.msisdn } });
      setCooldown(OTP_RESEND_SECONDS);
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    }
  }

  return (
    <StepLayout
      title="Code de vérification"
      description={
        <>
          Saisissez le code à {OTP_LENGTH} chiffres envoyé au <strong className="text-ink">{formatMsisdn(state.msisdn)}</strong>.
        </>
      }
      onBack={back}
      onNext={() => void verify(digits.join(""))}
      nextLabel="Valider"
      loading={loading}
    >
      <div className="flex justify-center gap-3" role="group" aria-label="Code de vérification">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={OTP_LENGTH}
            aria-label={`Chiffre ${i + 1}`}
            aria-invalid={Boolean(error)}
            autoFocus={i === 0}
            className={cx(
              "h-12 w-11 rounded-xl border-2 bg-white text-center text-xl font-black outline-none transition focus:border-airtel focus:ring-4 focus:ring-airtel/10",
              error ? "border-airtel" : d ? "border-ink/40" : "border-line",
            )}
          />
        ))}
      </div>
      {error && <p role="alert" className="text-center text-sm font-semibold text-airtel">{error}</p>}
      <div className="text-center text-sm">
        {cooldown > 0 ? (
          <span className="text-muted">Renvoyer le code dans {cooldown} s</span>
        ) : (
          <Button type="button" variant="ghost" size="md" onClick={() => void resend()}>Renvoyer le code</Button>
        )}
        {resent && <p className="mt-1 font-semibold text-success">Nouveau code envoyé.</p>}
      </div>
    </StepLayout>
  );
}
