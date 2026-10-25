import { PageShell } from "@/components/app/page-shell";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({ title: "Termos de uso", description: "Condições desta demonstração técnica.", path: "/termos" });

export default function Page() {
  return <PageShell title="Termos de uso" description="Condições desta demonstração técnica."><div className="flex max-w-3xl flex-col gap-4 text-sm leading-relaxed"><p>O Arremate é uma demonstração para avaliação técnica. Não realiza vendas nem transfere a propriedade de obras. Lances, depósitos, saldos e comprovantes são simulados e não têm valor financeiro ou fiscal.</p>
<p>As obras são de acervo público do The Metropolitan Museum of Art, com imagens Open Access (CC0) e créditos apresentados junto ao lote. A exibição não representa parceria ou endosso do museu.</p>
<p>Use somente dados fictícios e cartões de teste. Não informe cartão real, CVV real, chave Pix ou dados bancários. Nenhum valor real é cobrado ou recebido.</p>
<p>O ambiente pode ser pausado ou removido após a avaliação. Dados e comprovantes de demonstração não devem ser usados como registro de uma compra real.</p></div></PageShell>;
}
