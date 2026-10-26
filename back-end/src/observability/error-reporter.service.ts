import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import type { ErrorContext, ErrorEvent, ErrorTransport } from "./error-event";
import { sanitizePath, sanitizeStack, sanitizeText, sanitizeUrl } from "./sanitize";

const DEDUPE_MS = 60_000;
const MAX_PER_MINUTE = 30;

/** Transporte padrão (D25): só registra no log da API. Não há destino externo. */
export class LogTransport implements ErrorTransport {
  private readonly logger = new Logger("ErrorReporter");

  send(event: ErrorEvent): void {
    this.logger.error(JSON.stringify(event));
  }
}

/**
 * Relator de erros no estilo Sentry: saneia, agrupa por impressão digital (60 s) e limita a 30 eventos/min.
 * Nunca lança: falha no relator não pode virar outro erro.
 */
export class ErrorReporter {
  private readonly seen = new Map<string, number>();
  private windowStart = 0;
  private sent = 0;
  dropped = 0;

  constructor(
    private readonly transport: ErrorTransport = new LogTransport(),
    private readonly now: () => number = Date.now,
  ) {}

  capture(error: unknown, context: ErrorContext): ErrorEvent | null {
    try {
      const name = error instanceof Error ? error.name : typeof error;
      const message = sanitizeText(error instanceof Error ? error.message : error);
      const stack = error instanceof Error ? sanitizeStack(error.stack) : undefined;
      return this.record({ name, message, stack, ...context });
    } catch {
      return null;
    }
  }

  record(input: Omit<ErrorEvent, "fingerprint" | "occurredAt"> & { fingerprint?: string }): ErrorEvent | null {
    try {
      const path = sanitizePath(input.path);
      const event: ErrorEvent = {
        source: input.source,
        name: sanitizeText(input.name, 100) || "Error",
        message: sanitizeText(input.message),
        stack: sanitizeStack(input.stack),
        fingerprint: "",
        requestId: input.requestId ? sanitizeText(input.requestId, 64) : undefined,
        method: input.method ? sanitizeText(input.method, 10) : undefined,
        path,
        statusCode: input.statusCode,
        url: sanitizeUrl(input.url),
        digest: input.digest ? sanitizeText(input.digest, 64) : undefined,
        occurredAt: new Date(this.now()).toISOString(),
      };
      event.fingerprint = createHash("sha256").update([event.source, event.name, event.message, path ?? event.url ?? "", firstFrame(event.stack)].join("|")).digest("hex").slice(0, 16);
      const now = this.now();
      for (const [key, at] of this.seen) if (now - at >= DEDUPE_MS) this.seen.delete(key);
      if (this.seen.has(event.fingerprint)) return null;
      if (now - this.windowStart >= 60_000) {
        this.windowStart = now;
        this.sent = 0;
      }
      if (this.sent >= MAX_PER_MINUTE) {
        this.dropped += 1;
        return null;
      }
      this.seen.set(event.fingerprint, now);
      this.sent += 1;
      this.transport.send(event);
      return event;
    } catch {
      return null;
    }
  }
}

function firstFrame(stack: string | undefined): string {
  return stack?.split("\n").find((line) => line.trim().startsWith("at "))?.trim() ?? "";
}

/** D25: só o transporte de log está ligado; ERROR_TRANSPORT diferente de "log" cai no log com aviso. */
export function errorReporterFromEnv(): ErrorReporter {
  const choice = process.env.ERROR_TRANSPORT ?? "log";
  if (choice !== "log") new Logger("ErrorReporter").warn(`ERROR_TRANSPORT="${sanitizeText(choice, 20)}" não está disponível nesta demonstração; usando log.`);
  return new ErrorReporter(new LogTransport());
}
