import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import { AuthService } from "../auth/auth.service";
import { RateLimiter } from "../auth/rate-limit";
import { clientIp } from "../auth/session-cookie";
import { ErrorReporter } from "./error-reporter.service";

const MAX_BYTES = 8 * 1024;

/**
 * A6: erros do navegador (error.tsx, global-error, window.onerror). Sem sessão e sem CSRF (sendBeacon não manda
 * cabeçalho), mas com Origin conferida, limite de 8 KB e limite por IP. Só registra no log (D25).
 */
@Controller("client-errors")
export class ClientErrorsController {
  constructor(
    private readonly auth: AuthService,
    private readonly limits: RateLimiter,
    private readonly reporter: ErrorReporter,
  ) {}

  @Post()
  @HttpCode(202)
  report(@Req() request: Request, @Body() body: unknown): { accepted: true } {
    const origin = request.header("origin");
    if (!origin || !this.auth.isAllowedOrigin(origin)) throw new ApiException(403, "ACESSO_NEGADO");
    const length = Number(request.header("content-length") ?? "0");
    if (length > MAX_BYTES || JSON.stringify(body ?? null).length > MAX_BYTES) throw new ApiException(413, "CORPO_GRANDE_DEMAIS");
    try {
      this.limits.consume("clientError", clientIp(request));
    } catch (error) {
      if (error instanceof Error && error.message === "LIMITE_EXCEDIDO") throw new ApiException(429, "LIMITE_EXCEDIDO");
      throw error;
    }
    if (!isReport(body)) throw new ApiException(400, "REQUISICAO_INVALIDA");
    this.reporter.record({ source: "client", name: body.name ?? "Error", message: body.message, stack: body.stack, url: body.url, digest: body.digest });
    return { accepted: true };
  }
}

type ClientReport = { name?: string; message: string; stack?: string; url?: string; digest?: string };

function isReport(body: unknown): body is ClientReport {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  const allowed = new Set(["name", "message", "stack", "url", "digest"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) return false;
  if (typeof record.message !== "string" || record.message.length === 0) return false;
  return ["name", "stack", "url", "digest"].every((key) => record[key] === undefined || typeof record[key] === "string");
}
