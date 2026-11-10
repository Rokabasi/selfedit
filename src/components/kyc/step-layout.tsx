"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/primitives";

type Props = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  /** Le bouton principal soumet un <form> (validation au clavier / touche Entrée). */
  asForm?: boolean;
};

export function StepLayout({ title, description, children, onBack, onNext, nextLabel = "Continuer", nextDisabled, loading, asForm = true }: Props) {
  const body = (
    <>
      <div className="space-y-1">
        <h2 className="text-2xl font-black tracking-tight text-ink">{title}</h2>
        {description && <p className="text-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
      {(onNext || onBack) && (
        <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
          {onBack && (
            <Button type="button" variant="ghost" onClick={onBack} className="shrink-0">
              Retour
            </Button>
          )}
          {onNext && (
            <Button type={asForm ? "submit" : "button"} onClick={asForm ? undefined : onNext} block disabled={nextDisabled} loading={loading}>
              {nextLabel}
            </Button>
          )}
        </div>
      )}
    </>
  );

  return asForm && onNext ? (
    <form
      noValidate
      className="animate-fade-up space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      {body}
    </form>
  ) : (
    <div className="animate-fade-up space-y-6">{body}</div>
  );
}
