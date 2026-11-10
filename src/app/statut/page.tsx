import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusLookup } from "@/components/kyc/status-lookup";
import { AppHeader } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Statut de mon identification" };

export default function StatusPage() {
  return (
    <>
      <AppHeader subtitle="Statut KYC" />
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <Suspense>
          <StatusLookup />
        </Suspense>
      </main>
    </>
  );
}
