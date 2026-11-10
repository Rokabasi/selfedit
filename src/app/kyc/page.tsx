import type { Metadata } from "next";
import { KycWizard } from "@/components/kyc/kyc-wizard";
import { AppHeader } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Identification de ma SIM" };

export default function KycPage() {
  return (
    <>
      <AppHeader />
      <KycWizard />
    </>
  );
}
