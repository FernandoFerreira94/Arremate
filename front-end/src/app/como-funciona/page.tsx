import { HowItWorksPage } from "@/features/info/how-it-works-page";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({ title: "Como funciona a demonstração", description: "Os 5 passos de um leilão no Arremate, as regras e a auditoria pública. Valores inteiramente simulados.", path: "/como-funciona" });

export default function ComoFuncionaPage() {
  return <HowItWorksPage />;
}
