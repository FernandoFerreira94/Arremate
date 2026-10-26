/** B1 (plano erros-e-toasts): mensagens pt-BR por código de erro e de sucesso. Fonte única do filtro e das mutações. */
export const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  REQUISICAO_INVALIDA: { status: 400, message: "Requisição inválida." },
  CADASTRO_RECUSADO: { status: 400, message: "Não foi possível criar a conta. Verifique os dados ou tente entrar." },
  GOOGLE_INDISPONIVEL: { status: 503, message: "indisponível na demo" },
  GOOGLE_RECUSADO: { status: 400, message: "Não foi possível entrar com o Google. Tente de novo." },
  CREDENCIAIS_INVALIDAS: { status: 401, message: "E-mail ou senha inválidos." },
  SESSAO_NECESSARIA: { status: 401, message: "Entre na sua conta para continuar." },
  ACESSO_NEGADO: { status: 403, message: "Você não tem permissão para esta ação." },
  CSRF_RECUSADO: { status: 403, message: "Não foi possível confirmar esta requisição." },
  NAO_ENCONTRADO: { status: 404, message: "Recurso não encontrado." },
  LIMITE_EXCEDIDO: { status: 429, message: "Muitas tentativas. Aguarde um momento." },
  LIMITE_CONEXOES: { status: 429, message: "Muitas pessoas acompanhando este lote agora. Tente em instantes." },
  BANCO_INDISPONIVEL: { status: 503, message: "Banco de dados temporariamente indisponível." },
  IDEMPOTENCIA_INVALIDA: { status: 400, message: "Envie uma chave de idempotência válida." },
  VALOR_INVALIDO: { status: 400, message: "Informe valores em centavos maiores que zero e dentro do limite." },
  DATAS_INVALIDAS: { status: 400, message: "Confira as datas: o início não pode estar no passado e o fim deve vir depois do início." },
  OBRA_NAO_ENCONTRADA: { status: 404, message: "Obra não encontrada no acervo." },
  IDEMPOTENCIA_CONFLITO: { status: 409, message: "Esta chave já foi usada com outros dados." },
  CAPACIDADE_EXCEDIDA: { status: 409, message: "O saldo chegou ao limite técnico da carteira." },
  LOTE_NAO_CANCELAVEL: { status: 409, message: "Este lote não pode mais ser cancelado." },
  LOTE_JA_ABERTO: { status: 409, message: "Este lote já abriu; acompanhe direto na sala do lote." },
  LOTE_COM_LANCES: { status: 409, message: "Lotes com lances não podem ser cancelados." },
  LICENCA_RECUSADA: { status: 422, message: "Esta obra não está em domínio público." },
  IMAGEM_INVALIDA: { status: 422, message: "A imagem da obra não pôde ser validada." },
  ORIGEM_RECUSADA: { status: 502, message: "O acervo indicou uma origem não permitida." },
  PROVEDOR_RESPOSTA_INVALIDA: { status: 502, message: "O acervo respondeu de forma inesperada." },
  PROVEDOR_INDISPONIVEL: { status: 503, message: "O acervo do museu está indisponível. Tente novamente em instantes." },
  AUDITORIA_INDISPONIVEL: { status: 503, message: "Auditoria indisponível; publicação suspensa." },
  BID_BELOW_MINIMUM: { status: 409, message: "O lance precisa ser igual ou maior que o mínimo atual." },
  INSUFFICIENT_FUNDS: { status: 409, message: "Saldo disponível insuficiente para reservar este lance." },
  ALREADY_LEADING: { status: 409, message: "Você já lidera este lote; aguarde ser superado." },
  LOT_NOT_STARTED: { status: 409, message: "Este lote ainda não abriu para lances." },
  LOT_ENDED: { status: 409, message: "Este lote já encerrou." },
  LOT_CANCELLED: { status: 409, message: "Este lote foi cancelado." },
  LOTE_BLOQUEADO: { status: 409, message: "Lote bloqueado: a auditoria não confere." },
  CONFIRMATION_PENDING: { status: 503, message: "Confirmação pendente. Repita com a mesma chave para saber o resultado." },
  CORPO_GRANDE_DEMAIS: { status: 413, message: "O conteúdo enviado é grande demais." },
  ERRO_INTERNO: { status: 500, message: "Não foi possível concluir a operação." },
};

export const SUCCESS_MESSAGES = {
  LOGIN: "Login realizado.",
  CADASTRO: "Conta criada.",
  LOTE_PUBLICADO: "Lote publicado.",
  LOTE_CANCELADO: "Lote cancelado.",
  FAVORITO_ADICIONADO: "Adicionado aos favoritos.",
  FAVORITO_REMOVIDO: "Removido dos favoritos.",
  AVISO_ATIVADO: "Vamos avisar quando o lote abrir.",
  AVISO_DESATIVADO: "Aviso desativado.",
  NOTIFICACOES_LIDAS: "Notificações marcadas como lidas.",
  NOTIFICACAO_LIDA: "Notificação marcada como lida.",
  CARTAO_SALVO: "Cartão de teste salvo.",
} as const;

export function bidMessage(amountCents: string): string {
  return `Lance de ${formatBrl(amountCents)} registrado.`;
}

export function depositMessage(amountCents: string): string {
  return `Depósito de ${formatBrl(amountCents)} adicionado à carteira.`;
}

/** Só acrescenta `message` ao objeto que a rota já devolvia (formato aprovado no G1). */
export function withMessage<T extends object>(value: T, message: string): T & { message: string } {
  return { ...value, message };
}

/** Centavos (texto inteiro) para "R$ 1.234,56" sem Intl (sem depender do ICU do runtime). */
export function formatBrl(cents: string): string {
  const negative = cents.startsWith("-");
  const digits = (negative ? cents.slice(1) : cents).replace(/^0+(?=\d)/, "").padStart(3, "0");
  const reais = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${reais},${digits.slice(-2)}`;
}
