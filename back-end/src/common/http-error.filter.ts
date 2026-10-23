import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";

const safeErrors: Record<number, { code: string; message: string }> = {
  400: { code: "REQUISICAO_INVALIDA", message: "Requisição inválida." },
  401: { code: "SESSAO_NECESSARIA", message: "Entre na sua conta para continuar." },
  403: { code: "ACESSO_NEGADO", message: "Você não tem permissão para esta ação." },
  404: { code: "NAO_ENCONTRADO", message: "Recurso não encontrado." },
  503: { code: "BANCO_INDISPONIVEL", message: "Banco de dados temporariamente indisponível." },
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = error instanceof HttpException ? error.getStatus() : 500;
    const safe = safeErrors[statusCode] ?? { code: "ERRO_INTERNO", message: "Não foi possível concluir a operação." };
    const requestId = response.getHeader("x-request-id");
    if (statusCode >= 500 && statusCode !== 503) this.logger.error("Falha interna na requisição.", typeof requestId === "string" ? requestId : undefined);
    response.status(statusCode).json({ statusCode, ...safe, requestId });
  }
}
