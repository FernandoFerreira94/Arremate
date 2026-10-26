import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorReporter } from "../observability/error-reporter.service";
import { ERROR_MESSAGES as codes } from "./messages";


@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  constructor(private readonly reporter: ErrorReporter | null = null) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = error instanceof HttpException ? error.getStatus() : isTooLarge(error) ? 413 : 500;
    const safe = this.safeBody(error, statusCode);
    const header = response.getHeader("x-request-id");
    const requestId = typeof header === "string" ? header : undefined;
    if (statusCode >= 500 && statusCode !== 503) {
      this.logger.error("Falha interna na requisição.", requestId);
      const http = host.switchToHttp();
      const request = typeof http.getRequest === "function" ? http.getRequest<Request | undefined>() : undefined;
      this.reporter?.capture(error, { source: "api", requestId, method: request?.method, path: request?.originalUrl ?? request?.url, statusCode });
    }
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
