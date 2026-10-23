import type { Metadata } from "next";
import { RequireRole } from "@/components/app/require-role";
import { NewLotPage } from "@/features/seller/new-lot-page";

export const metadata: Metadata = { title: "Criar lote", description: "Publicar lote com obra de acervo público.", robots: { index: false, follow: false } };

export default function NovoLotePage() {
  return (
    <RequireRole role="AUCTIONEER">
      <NewLotPage />
    </RequireRole>
  );
}
