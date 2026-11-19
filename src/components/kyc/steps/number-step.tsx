"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Spinner, cx } from "@/components/ui/primitives";
import { ASSIGNABLE_PREFIXES, NUMBER_RESERVATION_MS } from "@/lib/constants";
import { isNumberAvailable, proposeNumbers } from "@/lib/kyc-db";
import { formatMsisdn, formatNational, normalizeMsisdn } from "@/lib/phone";
import { isReservationValid, useKyc } from "../kyc-store";
import { StepLayout } from "../step-layout";

/* --------------------------- Choix du numéro Airtel ------------------------ */

export function NumberStep() {
  const { state, dispatch, next, back } = useKyc();
  const [selected, setSelected] = useState(state.msisdn);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Les numéros secondaires saisis ne doivent jamais être proposés.
  const altPhones = [state.personal.altPhone1, state.personal.altPhone2]
    .map((v) => normalizeMsisdn(v))
    .filter((v): v is string => v !== null);
  const altKey = altPhones.join(",");

  const generate = useCallback(
    async (previous: string[] = []) => {
      setGenerating(true);
      setError(null);
      try {
        const options = await proposeNumbers(ASSIGNABLE_PREFIXES, [...altKey.split(",").filter(Boolean), ...previous]);
        if (options.length === 0) throw new Error("Aucun numéro disponible pour le moment. Réessayez.");
        dispatch({ type: "numberOptions", value: options });
        setSelected((cur) => (options.includes(cur) ? cur : ""));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de proposer des numéros");
      } finally {
        setGenerating(false);
      }
    },
    [dispatch, altKey],
  );

  // Première visite (ou options perdues) : on tire une série de numéros.
  useEffect(() => {
    if (state.numberOptions.length === 0) void generate();
  }, [state.numberOptions.length, generate]);

  // Le numéro déjà réservé reste affiché en tête, même après « Autres numéros ».
  const options =
    state.msisdn && !state.numberOptions.includes(state.msisdn) ? [state.msisdn, ...state.numberOptions] : state.numberOptions;

  async function submit() {
    if (!selected) return setError("Choisissez un numéro pour continuer");
    setSubmitting(true);
    setError(null);
    try {
      // Contrôle de dernière minute : le numéro a pu être attribué entre-temps.
      if (selected !== state.msisdn && !(await isNumberAvailable(selected))) {
        setError("Ce numéro vient d'être attribué. Choisissez-en un autre.");
        await generate(state.numberOptions);
        return;
      }
      const keepReservation = selected === state.msisdn && isReservationValid(state.reservation);
      dispatch({
        type: "selectNumber",
        msisdn: selected,
        reservedAt: keepReservation ? state.reservation!.at : new Date().toISOString(),
        expiresAt: keepReservation ? state.reservation!.expiresAt : Date.now() + NUMBER_RESERVATION_MS,
      });
      next();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StepLayout
      title="Choisissez votre numéro"
      description="Sélectionnez le numéro Airtel qui sera associé à votre nouvelle carte SIM."
      onBack={back}
      onNext={() => void submit()}
      nextDisabled={generating || options.length === 0}
      loading={submitting}
    >
      <fieldset className="space-y-3" aria-describedby={error ? "number-error" : undefined}>
        <legend className="sr-only">Numéros Airtel disponibles</legend>

        {generating && options.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-card border border-line p-6 text-sm text-muted">
            <Spinner /> Recherche de numéros disponibles…
          </div>
        ) : (
          options.map((msisdn) => (
            <NumberOption
              key={msisdn}
              msisdn={msisdn}
              checked={selected === msisdn}
              disabled={generating}
              onSelect={() => {
                setSelected(msisdn);
                setError(null);
              }}
            />
          ))
        )}
      </fieldset>

      {error && (
        <p id="number-error" role="alert" className="text-sm font-semibold text-airtel">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Le numéro choisi vous est réservé pendant {NUMBER_RESERVATION_MS / 60_000} minutes.</p>
        <Button type="button" variant="ghost" size="md" onClick={() => void generate(options)} disabled={generating || submitting}>
          {generating && options.length > 0 ? <Spinner /> : "↻"} Autres numéros
        </Button>
      </div>

      {state.msisdn && selected && selected !== state.msisdn && (
        <Alert tone="info">
          Vous remplacez le numéro {formatMsisdn(state.msisdn)} par {formatMsisdn(selected)}.
        </Alert>
      )}
    </StepLayout>
  );
}

function NumberOption({ msisdn, checked, disabled, onSelect }: { msisdn: string; checked: boolean; disabled?: boolean; onSelect: () => void }) {
  const prefix = `0${msisdn.slice(3, 5)}`;
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-4 rounded-card border-2 bg-white p-4 transition has-focus-visible:ring-4 has-focus-visible:ring-airtel/20",
        checked ? "border-airtel bg-airtel-50" : "border-line hover:border-ink/30",
        disabled && "cursor-wait opacity-60",
      )}
    >
      <input type="radio" name="msisdn" value={msisdn} checked={checked} onChange={onSelect} disabled={disabled} className="peer sr-only" />
      <span
        aria-hidden
        className={cx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          checked ? "border-airtel" : "border-line",
        )}
      >
        <span className={cx("h-2.5 w-2.5 rounded-full bg-airtel transition-transform", checked ? "scale-100" : "scale-0")} />
      </span>
      <span className="flex-1">
        <span className="block font-mono text-lg font-black tracking-wider text-ink">{formatNational(msisdn)}</span>
        <span className="block text-xs text-muted">{formatMsisdn(msisdn)}</span>
      </span>
      <span className="rounded-full bg-airtel px-2.5 py-1 text-xs font-black text-white">{prefix}</span>
    </label>
  );
}
