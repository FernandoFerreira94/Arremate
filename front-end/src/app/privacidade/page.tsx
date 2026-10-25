import { PageShell } from "@/components/app/page-shell";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({ title: "Privacidade", description: "Dados usados no ambiente de demonstração.", path: "/privacidade" });

export default function Page() {
  return <PageShell title="Privacidade" description="Dados usados no ambiente de demonstração."><div className="flex max-w-3xl flex-col gap-4 text-sm leading-relaxed"><p>A demonstração usa e-mail e senha de conta, cookies necessários de sessão e registros de lances, carteira e auditoria. Quando o cadastro estiver disponível, também usará o nome informado. Senhas são armazenadas como hash.</p>
<p>A API valida permissões e mantém os registros necessários ao funcionamento dos leilões simulados. Auditoria e comprovantes públicos identificam participantes por pseudônimo; não exibem e-mail ou senha.</p>
<p>Não informe dados de pagamento reais. Os recursos de pagamento simulado não devem enviar número completo de cartão ou CVV à API. Não há gateway ou cobrança real.</p>
<p>Para solicitar a remoção dos dados de avaliação, contate o responsável que forneceu o link desta demonstração. O ambiente pode ser removido após o teste técnico.</p></div></PageShell>;
}
