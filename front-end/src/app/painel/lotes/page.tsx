import type { Metadata } from "next";
import { RequireRole } from "@/components/app/require-role";
import { MyLotsPage } from "@/features/seller/my-lots-page";

export const metadata: Metadata = { title: "Meus lotes", description: "Lotes do leiloeiro.", robots: { index: false, follow: false } };

export default function PainelLotesPage() {
  return (
    <RequireRole role="AUCTIONEER">
      <MyLotsPage />
    </RequireRole>
  );
}
