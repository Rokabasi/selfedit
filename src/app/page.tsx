import Link from "next/link";
import { AppHeader } from "@/components/ui/brand";

const STEPS = [
  { n: "1", title: "Validez votre numéro", text: "Recevez un code par SMS sur votre nouvelle SIM." },
  { n: "2", title: "Renseignez vos informations", text: "Identité, adresse et codes de la carte SIM." },
  { n: "3", title: "Scannez votre pièce", text: "Carte d'électeur, passeport, permis…" },
  { n: "4", title: "Vérifiez votre visage", text: "Quelques mouvements simples devant la caméra." },
];

export default function HomePage() {
  return (
    <>
      <AppHeader
        right={
          <Link href="/statut" className="rounded-full px-3 py-1.5 text-sm font-bold text-airtel hover:bg-airtel-50">
            Suivre mon dossier
          </Link>
        }
      />
      <main>
        <section className="relative overflow-hidden bg-airtel text-white">
          <div aria-hidden className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-black/10" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:py-20">
            <p className="text-sm font-extrabold tracking-widest uppercase opacity-90">Airtel RDC · Self KYC</p>
            <h1 className="mt-3 max-w-2xl text-4xl leading-tight font-black sm:text-5xl">
              Identifiez votre SIM vous-même, en 5 minutes.
            </h1>
            <p className="mt-4 max-w-xl text-lg opacity-95">
              Sans file d&apos;attente : munissez-vous de votre nouvelle carte SIM et de votre pièce d&apos;identité.
              Ouvrez votre compte Airtel Money en même temps.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/kyc" className="inline-flex h-14 items-center justify-center rounded-full bg-white px-8 text-lg font-extrabold text-airtel shadow-lg transition hover:scale-[1.02]">
                Commencer l&apos;identification
              </Link>
              <Link href="/statut" className="inline-flex h-14 items-center justify-center rounded-full border-2 border-white/70 px-8 font-bold hover:bg-white/10">
                Vérifier le statut d&apos;un numéro
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-black">Comment ça marche ?</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-card border border-line bg-white p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-airtel text-lg font-black text-white">{s.n}</span>
                <h3 className="mt-4 font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["📶", "SIM insérée", "La nouvelle SIM doit être dans le téléphone pour recevoir le code."],
              ["🪪", "Pièce valide", "Une pièce d'identité en cours de validité, en bon état."],
              ["💡", "Bon éclairage", "Un endroit lumineux pour le scan et la vérification du visage."],
            ].map(([icon, title, text]) => (
              <div key={title} className="flex gap-3 rounded-card bg-white p-5">
                <span className="text-2xl" aria-hidden>{icon}</span>
                <div>
                  <p className="font-extrabold">{title}</p>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line bg-white py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Airtel Congo RDC · <Link href="/backoffice" className="underline">Espace agent</Link>
      </footer>
    </>
  );
}
