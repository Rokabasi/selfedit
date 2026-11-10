"use client";

import { formatMsisdn } from "@/lib/phone";
import { KycProvider, PROGRESS_STEPS, useKyc } from "./kyc-store";
import { OtpStep, PhoneStep } from "./steps/auth-steps";
import { DocumentStep, LivenessStep } from "./steps/capture-steps";
import { ConsentStep, DoneStep, ReviewStep } from "./steps/final-steps";
import { IdentityStep, PersonalStep, SimStep } from "./steps/form-steps";

export function KycWizard() {
  return (
    <KycProvider>
      <WizardBody />
    </KycProvider>
  );
}

function WizardBody() {
  const { state } = useKyc();
  const progressIndex = PROGRESS_STEPS.findIndex((s) => s.id === state.step);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-4 pb-10 sm:pt-8">
      {progressIndex >= 0 && (
        <div className="mb-5 space-y-2" aria-label="Progression">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-airtel">
              Étape {progressIndex + 1}/{PROGRESS_STEPS.length} · {PROGRESS_STEPS[progressIndex]!.label}
            </span>
            <span className="text-muted">{formatMsisdn(state.msisdn)}</span>
          </div>
          <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={PROGRESS_STEPS.length} aria-valuenow={progressIndex + 1}>
            {PROGRESS_STEPS.map((s, i) => (
              <span key={s.id} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= progressIndex ? "bg-airtel" : "bg-line"}`} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-card bg-white p-5 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.15)] sm:p-7">
        {state.step === "phone" && <PhoneStep />}
        {state.step === "otp" && <OtpStep />}
        {state.step === "identity" && <IdentityStep />}
        {state.step === "personal" && <PersonalStep />}
        {state.step === "sim" && <SimStep />}
        {state.step === "document" && <DocumentStep />}
        {state.step === "liveness" && <LivenessStep />}
        {state.step === "consent" && <ConsentStep />}
        {state.step === "review" && <ReviewStep />}
        {state.step === "done" && <DoneStep />}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        🔒 Vos données sont chiffrées en transit et traitées conformément à la réglementation en vigueur en RDC.
      </p>
    </main>
  );
}
