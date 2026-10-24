import type { Metadata } from "next";
import { FaqPage } from "@/features/info/faq-page";

export const metadata: Metadata = { title: "Suporte e perguntas frequentes", description: "Dúvidas sobre lances, carteira simulada, auditoria e conta na demonstração Arremate." };

export default function SuportePage() {
  return <FaqPage />;
}
