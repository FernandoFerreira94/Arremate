import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

const codes: Record<string, { status: number; message: string }> = {
  REQUISICAO_INVALIDA: { status: 400, message: "Requisição inválida." },
  CREDENCIAIS_INVALIDAS: { status: 401, message: "E-mail ou senha inválidos." },
  SESSAO_NECESSARIA: { status: 401, message: "Entre na sua conta para continuar." },
  ACESSO_NEGADO: { status: 403, message: "Você não tem permissão para esta ação." },
  CSRF_RECUSADO: { status: 403, message: "Não foi possível confirmar esta requisição." },
  NAO_ENCONTRADO: { status: 404, message: "Recurso não encontrado." },
  LIMITE_EXCEDIDO: { status: 429, message: "Muitas tentativas. Aguarde um momento." },
  BANCO_INDISPONIVEL: { status: 503, message: "Banco de dados temporariamente indisponível." },
  ERRO_INTERNO: { status: 500, message: "Não foi possível concluir a operação." },
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = error instanceof HttpException ? error.getStatus() : 500;
    const safe = this.safeBody(error, statusCode);
    const header = response.getHeader("x-request-id");
    const requestId = typeof header === "string" ? header : undefined;
    if (statusCode >= 500 && statusCode !== 503) this.logger.error("Falha interna na requisição.", requestId);
    response.status(statusCode).json({ statusCode, ...safe, requestId });
  }

  private safeBody(error: unknown, statusCode: number): { code: string; message: string } {
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
