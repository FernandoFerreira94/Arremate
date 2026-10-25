import Link from "next/link";
import { ClockIcon, GavelIcon, LogInIcon, ReceiptTextIcon, ScaleIcon, SearchIcon, ShieldCheckIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  { icon: SearchIcon, title: "Escolha um lote", text: "Navegue pela vitrine: ao vivo, agendados, encerrados e os que encerram hoje." },
  { icon: LogInIcon, title: "Entre na sua conta", text: "Use o botão Entrar no topo. Contas de licitante da demonstração já têm saldo simulado." },
  { icon: WalletIcon, title: "Tenha saldo disponível", text: "O lance só é aceito se couber no seu saldo disponível. Adicione saldo simulado na Carteira." },
  { icon: GavelIcon, title: "Dê seu lance", text: "Confirme o valor. Enquanto você lidera, ele fica comprometido na carteira." },
  { icon: ReceiptTextIcon, title: "Arremate e comprovante", text: "Ao encerrar, quem lidera arremata e recebe um comprovante público verificável." },
];

const RULES = [
  "Cada lance supera o atual pelo menos no incremento mínimo do lote.",
  "Um lance nos 2 minutos finais prorroga o fim para 2 minutos depois dele.",
  "Quando você é superado, o valor comprometido volta na hora para o disponível.",
  "O horário oficial é o do servidor, em horário de Brasília (UTC−3).",
  "Leiloeiros publicam e acompanham lotes, mas não dão lances.",
  "Valores, saldos e comprovantes são simulados; nenhuma obra está à venda.",
];

/** R10: 5 passos + regras essenciais + CTA. Também ancora "Regras" e "Auditoria pública" do menu (R5). */
export function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="max-w-3xl">
        <h1 className="text-4xl lg:text-5xl">Como funciona a demonstração</h1>
        <p className="mt-2 text-muted-foreground">Do primeiro clique ao comprovante, em cinco passos.</p>
      </div>
      <ol className="grid gap-4 md:grid-cols-5">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2 pt-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-primary"><step.icon className="size-5" aria-hidden /></span>
                <span className="text-xs text-muted-foreground">Passo {index + 1}</span>
                <h2 className="font-serif text-lg leading-tight">{step.title}</h2>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="regras" className="scroll-mt-24">
          <CardHeader><CardTitle className="flex items-center gap-2"><ScaleIcon className="size-5 text-primary" aria-hidden /> Regras essenciais</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">{RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </CardContent>
        </Card>
        <Card id="auditoria" className="scroll-mt-24">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheckIcon className="size-5 text-primary" aria-hidden /> Auditoria pública</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>Cada lance aceito entra numa cadeia assinada (HMAC). Qualquer pessoa pode abrir a auditoria de um lote e conferir se a cadeia está íntegra.</p>
            <p className="inline-flex items-center gap-1.5 text-muted-foreground"><ClockIcon className="size-4" aria-hidden /> Abra um lote e use o botão &quot;Auditoria pública&quot; na sala.</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-xl">Pronto para ver os lotes ao vivo?</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href="/?aba=ao-vivo"><GavelIcon /> Ver leilões ao vivo</Link></Button>
            <Button asChild variant="outline"><Link href="/suporte">Dúvidas frequentes</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
