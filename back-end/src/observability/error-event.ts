/** Evento de erro no formato do relator (estilo Sentry, sem SDK). Nunca leva corpo, cookie, token ou query. */
export type ErrorSource = "api" | "process" | "client";

export type ErrorEvent = {
  source: ErrorSource;
  name: string;
  message: string;
  stack?: string;
  fingerprint: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  url?: string;
  digest?: string;
  occurredAt: string;
};

export type ErrorContext = Partial<Pick<ErrorEvent, "requestId" | "method" | "path" | "statusCode" | "url" | "digest">> & { source: ErrorSource };

export interface ErrorTransport {
  send(event: ErrorEvent): void;
}
