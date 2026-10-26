import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

const codes: Record<string, { status: number; message: string }> = {
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
  BANCO_INDISPONIVEL: { status: 503, message: "Banco de dados temporariamente indisponível." },
  IDEMPOTENCIA_INVALIDA: { status: 400, message: "Envie uma chave de idempotência válida." },
  VALOR_INVALIDO: { status: 400, message: "Informe valores em centavos maiores que zero e dentro do limite." },
  DATAS_INVALIDAS: { status: 400, message: "Confira as datas: o início não pode estar no passado e o fim deve vir depois do início." },
  OBRA_NAO_ENCONTRADA: { status: 404, message: "Obra não encontrada no acervo." },
  IDEMPOTENCIA_CONFLITO: { status: 409, message: "Esta chave já foi usada com outros dados." },
  CAPACIDADE_EXCEDIDA: { status: 409, message: "O saldo chegou ao limite técnico da carteira." },
  LOTE_NAO_CANCELAVEL: { status: 409, message: "Este lote não pode mais ser cancelado." },
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

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = error instanceof HttpException ? error.getStatus() : isTooLarge(error) ? 413 : 500;
    const safe = this.safeBody(error, statusCode);
    const header = response.getHeader("x-request-id");
    const requestId = typeof header === "string" ? header : undefined;
    if (statusCode >= 500 && statusCode !== 503) this.logger.error("Falha interna na requisição.", requestId);
    response.status(statusCode).json({ statusCode, ...safe, requestId });
  }

  private safeBody(error: unknown, statusCode: number): { code: string; message: string } {
    if (statusCode === 413) return { code: "CORPO_GRANDE_DEMAIS", message: codes.CORPO_GRANDE_DEMAIS.message };
    const fallback = statusCode === 404
      ? { code: "NAO_ENCONTRADO", message: codes.NAO_ENCONTRADO.message }
      : statusCode === 400
        ? { code: "REQUISICAO_INVALIDA", message: codes.REQUISICAO_INVALIDA.message }
        : statusCode === 401
          ? { code: "SESSAO_NECESSARIA", message: codes.SESSAO_NECESSARIA.message }
          : statusCode === 403
            ? { code: "ACESSO_NEGADO", message: codes.ACESSO_NEGADO.message }
            : statusCode === 429
              ? { code: "LIMITE_EXCEDIDO", message: codes.LIMITE_EXCEDIDO.message }
              : statusCode === 503
                ? { code: "BANCO_INDISPONIVEL", message: codes.BANCO_INDISPONIVEL.message }
                : { code: "ERRO_INTERNO", message: codes.ERRO_INTERNO.message };
    if (!(error instanceof HttpException)) return fallback;
    const body = error.getResponse();
    if (typeof body !== "object" || body === null || !("code" in body) || typeof body.code !== "string") return fallback;
    const known = codes[body.code];
    if (!known || known.status !== statusCode) return fallback;
    return { code: body.code, message: known.message };
  }
}

/** Erro do body-parser (limite do corpo JSON), que não é HttpException. */
function isTooLarge(error: unknown): boolean {
  return typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large";
}
