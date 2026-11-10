import type { Metadata } from "next";
import { RecordDetail } from "@/components/backoffice/record-detail";
import { AppHeader } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Dossier KYC" };

export default async function RecordPage({ params }: { params: Promise<{ msisdn: string }> }) {
  const { msisdn } = await params;
  return (
    <>
      <AppHeader subtitle="Back-office KYC" />
      <RecordDetail msisdn={msisdn} />
    </>
  );
}
