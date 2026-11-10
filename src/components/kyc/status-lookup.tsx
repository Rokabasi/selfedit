"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Field, Input, StatusBadge } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import { formatMsisdn, normalizeMsisdn } from "@/lib/phone";
import type { KycStatus } from "@/lib/types";

type StatusResponse = { msisdn: string; reference: string; status: KycStatus; submittedAt: string; updatedAt: string; reason: string | null };

const MESSAGES: Record<KycStatus, string> = {
  PENDING: "Votre dossier est en cours de vérification par nos équipes.",
  APPROVED: "Votre ligne est identifiée. Tous les services sont actifs.",
  REJECTED: "Votre dossier n'a pas pu être validé. Vous pouvez recommencer l'identification.",
};

export function StatusLookup() {
  const params = useSearchParams();
  const router = useRouter();
  const [value, setValue] = useState(() => {
    const m = normalizeMsisdn(params.get("msisdn") ?? "");
    return m ? `0${m.slice(3)}` : "";
  });
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(
    async (raw: string) => {
      setError(null);
      setResult(null);
      const msisdn = normalizeMsisdn(raw);
      if (!msisdn) return setError("Numéro invalide, ex. 099 123 4567");
      setLoading(true);
      try {
        setResult(await api<StatusResponse>(`/api/kyc/status?msisdn=${msisdn}`));
        router.replace(`/statut?msisdn=${msisdn}`, { scroll: false });
      } catch (err) {
        setError(err instanceof ApiError && err.status === 404 ? "Aucun dossier d'identification pour ce numéro." : (err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (params.get("msisdn")) void lookup(params.get("msisdn")!);
    // Recherche initiale uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-card bg-white p-5 shadow-sm sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(value);
        }}
      >
        <div>
          <h1 className="text-2xl font-black">Statut de l&apos;identification</h1>
          <p className="text-muted">Saisissez le numéro Airtel identifié.</p>
        </div>
        <Field label="Numéro Airtel" error={error ?? undefined}>
          {(p) => <Input {...p} type="tel" inputMode="tel" placeholder="099 123 4567" value={value} onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <Button type="submit" block loading={loading}>Vérifier le statut</Button>
      </form>

      {result && (
        <div className="animate-fade-up space-y-4 rounded-card bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black">{formatMsisdn(result.msisdn)}</span>
            <StatusBadge status={result.status} />
          </div>
          <Alert tone={result.status === "APPROVED" ? "success" : result.status === "REJECTED" ? "error" : "warning"}>
            {MESSAGES[result.status]}
            {result.reason && <p className="mt-1 font-bold">Motif : {result.reason}</p>}
          </Alert>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Référence</dt>
              <dd className="font-mono font-bold">{result.reference}</dd>
            </div>
            <div>
              <dt className="text-muted">Soumis le</dt>
              <dd className="font-bold">{new Date(result.submittedAt).toLocaleString("fr-FR")}</dd>
            </div>
          </dl>
          {result.status === "REJECTED" && (
            <Link href="/kyc" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-airtel font-bold text-white">
              Recommencer l&apos;identification
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
