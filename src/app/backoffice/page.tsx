import type { Metadata } from "next";
import { RecordList } from "@/components/backoffice/record-list";
import { AppHeader } from "@/components/ui/brand";

export const metadata: Metadata = { title: "Back-office KYC" };

export default function BackofficePage() {
  return (
    <>
      <AppHeader subtitle="Back-office KYC" />
      <RecordList />
    </>
  );
}
