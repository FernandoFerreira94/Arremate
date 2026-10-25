import { PageShell } from "@/components/app/page-shell";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({ title: "Como funciona a demonstração", description: "Leilões de arte com valores inteiramente simulados.", path: "/como-funciona" });

export default function Page() {
  return <PageShell title="Como funciona a demonstração" description="Leilões de arte com valores inteiramente simulados."><div className="flex max-w-3xl flex-col gap-4 text-sm leading-relaxed"><p>Visitantes podem consultar vitrine, sala, histórico público de lances e auditoria. As imagens e os créditos vêm do acervo público do The Met.</p>
<p>Licitantes entram na própria conta, adicionam saldo simulado e dão lances. Liderar um lote compromete o valor do lance; ser superado libera essa reserva. Todo saldo e prazo é confirmado pela API.</p>
<p>Um lance aceito nos últimos dois minutos renova o término para dois minutos após o aceite. Ao encerrar, o sistema liquida o resultado e emite um comprovante simulado.</p>
<p>Leiloeiros publicam e acompanham os próprios lotes. Nenhuma obra está à venda e nenhum saldo pode ser convertido em dinheiro real.</p></div></PageShell>;
}
