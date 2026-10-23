import type { Metadata } from "next";
import { RequireRole } from "@/components/app/require-role";
import { WalletPage } from "@/features/wallet/wallet-page";

export const metadata: Metadata = { title: "Carteira", description: "Saldo simulado do licitante.", robots: { index: false, follow: false } };

export default function CarteiraPage() {
  return (
    <RequireRole role="BIDDER">
      <WalletPage />
    </RequireRole>
  );
}
