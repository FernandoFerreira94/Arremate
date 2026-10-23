import type { Metadata } from "next";
import { RequireRole } from "@/components/app/require-role";
import { MyAwardsPage } from "@/features/awards/my-awards-page";

export const metadata: Metadata = { title: "Meus arremates", description: "Arremates e participações do licitante.", robots: { index: false, follow: false } };

export default function MeusArrematesPage() {
  return (
    <RequireRole role="BIDDER">
      <MyAwardsPage />
    </RequireRole>
  );
}
