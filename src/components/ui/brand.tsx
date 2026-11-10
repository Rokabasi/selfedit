import Link from "next/link";

/**
 * Logotype textuel. Pour la production, remplacer par le fichier officiel fourni
 * par la communication Airtel (ex. /public/brand/airtel-logo.svg).
 */
export function AirtelWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-black tracking-tight text-airtel ${className}`}>
      airtel
    </span>
  );
}

export function AppHeader({ subtitle = "Self KYC", right }: { subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Accueil Airtel Self KYC">
          <AirtelWordmark className="text-2xl" />
          <span className="h-5 w-px bg-line" aria-hidden />
          <span className="text-sm font-semibold text-muted">{subtitle}</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
