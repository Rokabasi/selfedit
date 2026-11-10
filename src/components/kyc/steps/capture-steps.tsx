"use client";

import { useCallback } from "react";
import { DocumentScanner } from "@/components/capture/document-scanner";
import { LivenessCheck } from "@/components/capture/liveness-check";
import type { CapturedDocument, LivenessResult } from "@/lib/schemas";
import { getIdType } from "@/lib/constants";
import { useKyc } from "../kyc-store";
import { StepLayout } from "../step-layout";

export function DocumentStep() {
  const { state, dispatch, next, back } = useKyc();
  const idType = getIdType(state.identity.idType);
  const isPassport = state.identity.idType === "PASSEPORT";
  const requiresBack = idType?.requiresBack ?? true;
  const { front, back: verso } = state.documents;

  const setFront = useCallback(
    (doc: CapturedDocument | null) => dispatch({ type: "documents", value: { ...state.documents, front: doc } }),
    [dispatch, state.documents],
  );
  const setBack = useCallback(
    (doc: CapturedDocument | null) => dispatch({ type: "documents", value: { ...state.documents, back: doc } }),
    [dispatch, state.documents],
  );

  const complete = Boolean(front) && (!requiresBack || Boolean(verso));

  return (
    <StepLayout
      title="Scannez votre pièce"
      description={`${idType?.label ?? "Pièce d'identité"} — ${requiresBack ? "recto puis verso" : "page avec votre photo"}.`}
      onBack={back}
      onNext={next}
      nextDisabled={!complete}
      asForm={false}
    >
      <DocumentScanner
        key={`front-${state.identity.idType}`}
        title={isPassport ? "Page d'identité du passeport" : "Recto de la pièce"}
        instructions={isPassport ? "Ouvrez le passeport à la page qui comporte votre photo." : "Face avec votre photo."}
        frameRatio={isPassport ? 1.42 : 1.586}
        value={front}
        onChange={setFront}
      />
      {requiresBack && front && (
        <div className="border-t border-line pt-5">
          <DocumentScanner
            key={`back-${state.identity.idType}`}
            title="Verso de la pièce"
            instructions="Retournez la pièce et scannez l'autre face."
            frameRatio={1.586}
            value={verso}
            onChange={setBack}
          />
        </div>
      )}
    </StepLayout>
  );
}

export function LivenessStep() {
  const { state, dispatch, next, back } = useKyc();
  const onChange = useCallback((v: LivenessResult | null) => dispatch({ type: "liveness", value: v }), [dispatch]);

  return (
    <StepLayout
      title="Vérification du visage"
      description="Une preuve de vie confirme que vous êtes bien le titulaire de la pièce."
      onBack={back}
      onNext={next}
      nextDisabled={!state.liveness}
      asForm={false}
    >
      <LivenessCheck value={state.liveness} onChange={onChange} />
    </StepLayout>
  );
}
