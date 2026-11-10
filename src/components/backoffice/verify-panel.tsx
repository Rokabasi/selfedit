"use client";

import { useState } from "react";
import { Alert, Button, StatusBadge, cx } from "@/components/ui/primitives";
import { listRecords, updateStatus } from "@/lib/kyc-db";
import type { KycRecord } from "@/lib/types";
import { canApprove, runChecks } from "@/lib/verification";

export function VerifyPanel({ record, onUpdated }: { record: KycRecord; onUpdated: (r: KycRecord) => void }) {
  const [checks, setChecks] = useState(record.verification?.checks ?? null);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function run(action: "verify" | "reject") {
    setBusy(action);
    setMessage(null);
    try {
      const results = runChecks(record, await listRecords());
      setChecks(results);
      let updated: KycRecord | null = null;
      if (action === "reject") {
        updated = await updateStatus(record.msisdn, { status: "REJECTED", checks: results, by: "back-office", reason: reason.trim() });
        setMessage({ tone: "warning", text: "Dossier rejeté." });
        setRejecting(false);
      } else if (canApprove(results)) {
        updated = await updateStatus(record.msisdn, { status: "APPROVED", checks: results, by: "back-office", reason: "Contrôles automatiques conformes" });
        setMessage({ tone: "success", text: "Tous les contrôles sont conformes : dossier APPROVED." });
      } else {
        setMessage({ tone: "error", text: "Des contrôles bloquants ont échoué : le dossier reste en attente." });
      }
      if (updated) onUpdated(updated);
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <section className="space-y-4 rounded-card border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-wide text-airtel uppercase">Vérification</h2>
          <StatusBadge status={record.status} />
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
          <p className="text-sm text-muted">Lancez la vérification pour exécuter les contrôles sur ce dossier.</p>
        )}

        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        {record.status !== "APPROVED" && (
          <Button block size="md" onClick={() => void run("verify")} loading={busy === "verify"} disabled={busy !== null}>
            Vérifier et approuver
          </Button>
        )}

        {record.status === "PENDING" &&
          (rejecting ? (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Motif du rejet (communiqué à l'abonné)"
                className="w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-airtel"
              />
              <div className="flex gap-2">
                <Button size="md" variant="secondary" onClick={() => setRejecting(false)}>Annuler</Button>
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
