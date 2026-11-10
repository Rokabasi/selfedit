"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* --------------------------------- Button ---------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export function Button({ variant = "primary", size = "lg", loading, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-airtel/25 disabled:cursor-not-allowed disabled:opacity-50",
        size === "lg" ? "h-10 px-5 text-sm" : "h-9 px-4 text-[13px]",
        variant === "primary" && "bg-airtel text-white shadow-[0_6px_16px_-6px_rgb(228_0_0/0.6)] hover:bg-airtel-dark active:scale-[0.98]",
        variant === "secondary" && "border-2 border-airtel bg-white text-airtel hover:bg-airtel-50",
        variant === "ghost" && "text-ink hover:bg-surface",
        variant === "dark" && "bg-ink text-white hover:bg-black",
        block && "w-full",
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------- Field ---------------------------------- */

type FieldProps = {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
};

export function Field({ label, error, hint, optional, children, className }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-bold text-ink">
        {label}
        {optional ? (
          <span className="ml-1.5 font-semibold text-muted">(facultatif)</span>
        ) : (
          <span className="ml-0.5 text-airtel" aria-hidden>*</span>
        )}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error || hint ? descId : undefined })}
      {error ? (
        <p id={descId} role="alert" className="text-xs font-semibold text-airtel">{error}</p>
      ) : hint ? (
        <p id={descId} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-airtel focus:ring-3 focus:ring-airtel/10 aria-[invalid=true]:border-airtel aria-[invalid=true]:bg-airtel-50/40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} {...rest} className={cx(controlBase, "border-line", className)} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={cx(controlBase, "appearance-none border-line pr-10", className)}>
        {children}
      </select>
      <svg className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
      </svg>
    </div>
  );
}

/* -------------------------------- Checkbox --------------------------------- */

export function CheckboxCard({
  checked,
  onChange,
  title,
  description,
  error,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  error?: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={cx(
          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition",
          checked ? "border-airtel bg-airtel-50" : "border-line bg-white hover:border-muted/40",
          error && !checked && "border-airtel/60",
        )}
      >
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden
          className={cx(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-airtel/25",
            checked ? "border-airtel bg-airtel text-white" : "border-muted/50 bg-white",
          )}
        >
          {checked && (
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" /></svg>
          )}
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2 font-bold text-ink">{icon}{title}</span>
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
      </label>
      {error && !checked && <p role="alert" className="mt-1 text-sm font-semibold text-airtel">{error}</p>}
    </div>
  );
}

/* ---------------------------------- Misc ----------------------------------- */

export function Alert({ tone = "info", children, title }: { tone?: "info" | "error" | "success" | "warning"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-line bg-white text-ink",
    error: "border-airtel/30 bg-airtel-50 text-airtel-dark",
    success: "border-success/30 bg-success-50 text-success",
    warning: "border-warning/30 bg-warning-50 text-warning",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-bold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const map = {
    PENDING: { label: "PENDING", text: "En vérification", cls: "bg-warning-50 text-warning ring-warning/30" },
    APPROVED: { label: "APPROVED", text: "Approuvé", cls: "bg-success-50 text-success ring-success/30" },
    REJECTED: { label: "REJECTED", text: "Rejeté", cls: "bg-airtel-50 text-airtel-dark ring-airtel/30" },
  }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wide ring-1", map.cls)} title={map.text}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {map.label}
    </span>
  );
}

export { cx };
