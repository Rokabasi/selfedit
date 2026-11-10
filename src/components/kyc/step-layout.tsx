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
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      {(onNext || onBack) && (
        <div className="sticky bottom-0 -mx-5 flex justify-end gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
          {onBack && (
            <Button type="button" variant="secondary" size="md" onClick={onBack} className="w-36 max-sm:flex-1">
              Retour
            </Button>
          )}
          {onNext && (
            <Button type={asForm ? "submit" : "button"} size="md" onClick={asForm ? undefined : onNext} disabled={nextDisabled} loading={loading} className="w-36 max-sm:flex-1">
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
