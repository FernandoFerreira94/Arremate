import type { Metadata } from "next";
import { HowItWorksPage } from "@/features/info/how-it-works-page";

export const metadata: Metadata = { title: "Como funciona", description: "Os 5 passos de um leilão no Arremate, as regras e a auditoria pública." };

export default function ComoFuncionaPage() {
  return <HowItWorksPage />;
}
