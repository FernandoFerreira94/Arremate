export type FaqCategory = "lances" | "carteira" | "conta" | "seguranca";
export type FaqItem = { id: string; category: FaqCategory; question: string; answer: string };

export const FAQ_CATEGORIES: Array<{ value: FaqCategory | "todas"; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "lances", label: "Lances" },
  { value: "carteira", label: "Carteira" },
  { value: "conta", label: "Conta" },
  { value: "seguranca", label: "Segurança" },
];

export const FAQ_ITEMS: FaqItem[] = [
  { id: "valores", category: "lances", question: "Os valores são reais?", answer: "Não. O Arremate é uma demonstração técnica: saldos, lances e comprovantes são simulados e nenhuma obra está à venda." },
  { id: "minimo", category: "lances", question: "Qual é o lance mínimo?", answer: "O primeiro lance é o lance inicial do lote. Depois, cada lance precisa superar o atual pelo menos no incremento mínimo mostrado na sala." },
  { id: "prorrogacao", category: "lances", question: "O que é a prorrogação de 2 minutos?", answer: "Um lance aceito nos 2 minutos finais leva o fim do lote para 2 minutos depois daquele lance. Assim ninguém vence por um lance de último segundo." },
  { id: "superado", category: "lances", question: "O que acontece quando alguém cobre meu lance?", answer: "O valor que estava comprometido volta na hora para o seu saldo disponível, e a sala avisa que você foi superado." },
  { id: "comprometido", category: "carteira", question: "O que é saldo comprometido?", answer: "É o valor do lance em que você está liderando. Ele fica reservado na carteira até você ser superado ou o lote encerrar." },
  { id: "deposito", category: "carteira", question: "Como adiciono saldo?", answer: "Na Carteira, use Adicionar saldo. Cada depósito simulado vai de R$ 1,00 a R$ 100.000,00." },
  { id: "conta-demo", category: "conta", question: "Como entro para dar lances?", answer: "Clique em Entrar no topo da página e use uma conta de licitante da demonstração. A página /entrar também continua disponível." },
  { id: "redefinir", category: "conta", question: "Esqueci a senha. E agora?", answer: "Em Entrar › Redefinir, informe o e-mail. A resposta é sempre a mesma, por segurança. Na demonstração nenhum e-mail é enviado de fato." },
  { id: "auditoria", category: "seguranca", question: "Como sei que o histórico não foi alterado?", answer: "Cada lance entra numa cadeia com assinatura HMAC. A página de auditoria pública de cada lote confere a cadeia e mostra se ela está íntegra." },
  { id: "privacidade", category: "seguranca", question: "Quais dados meus aparecem para outros licitantes?", answer: "Nenhum dado pessoal. Na sala e nos últimos lances você aparece com um apelido gerado para aquele lote." },
];

export function filterFaq(items: FaqItem[], query: string, category: FaqCategory | "todas"): FaqItem[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = normalize(query.trim());
  return items.filter((item) => (category === "todas" || item.category === category) && (!q || normalize(`${item.question} ${item.answer}`).includes(q)));
}
