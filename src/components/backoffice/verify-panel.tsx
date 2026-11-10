"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, StatusBadge, cx } from "@/components/ui/primitives";
import { ApiError, api } from "@/lib/client/api";
import type { KycStatus, VerificationCheck } from "@/lib/types";

type VerifyResponse = { status: KycStatus; checks: VerificationCheck[]; approved?: boolean };

export function VerifyPanel({ msisdn, status, initialChecks }: { msisdn: string; status: KycStatus; initialChecks: VerificationCheck[] | null }) {
  const router = useRouter();
  const [checks, setChecks] = useState(initialChecks);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  async function run(action: "verify" | "reject") {
    setBusy(action);
    setMessage(null);
    try {
      const res = await api<VerifyResponse>(`/api/admin/kyc/${msisdn}/verify`, { body: action === "verify" ? { action } : { action, reason } });
      setChecks(res.checks);
      setMessage(
        action === "reject"
          ? { tone: "warning", text: "Dossier rejeté." }
          : res.approved
            ? { tone: "success", text: "Tous les contrôles sont conformes : dossier APPROVED." }
            : { tone: "error", text: "Des contrôles bloquants ont échoué : le dossier reste en attente." },
      );
      setRejecting(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError || err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-wide text-airtel uppercase">Vérification</h2>
          <StatusBadge status={status} />
        </div>

        {checks ? (
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm">
                <span
                  className={cx(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white",
                    c.passed ? "bg-success" : c.blocking ? "bg-airtel" : "bg-warning",
                  )}
                  aria-label={c.passed ? "conforme" : "non conforme"}
                >
                  {c.passed ? "✓" : "!"}
                </span>
                <span>
                  <span className="font-bold">{c.label}</span>
                  {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Lancez la vérification pour exécuter les contrôles automatiques sur ce dossier.</p>
        )}

        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        {status !== "APPROVED" && (
          <Button block onClick={() => void run("verify")} loading={busy === "verify"} disabled={busy !== null}>
            Vérifier et approuver
          </Button>
        )}

        {status === "PENDING" &&
          (rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Motif du rejet (communiqué à l'abonné)"
                className="w-full rounded-xl border-2 border-line p-3 text-sm outline-none focus:border-airtel"
              />
              <div className="flex gap-2">
                <Button size="md" variant="ghost" onClick={() => setRejecting(false)}>Annuler</Button>
                <Button size="md" variant="dark" block onClick={() => void run("reject")} loading={busy === "reject"} disabled={reason.trim().length < 5}>
                  Confirmer le rejet
                </Button>
              </div>
            </div>
          ) : (
            <Button block variant="secondary" size="md" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Rejeter le dossier
            </Button>
          ))}
      </section>
    </aside>
  );
}
