import { ApiError } from "./api-error";

/**
 * A6: relato de erro do navegador para POST /api/client-errors (só log no servidor, D25).
 * No máximo 5 eventos por 60 s por aba, sem repetir o mesmo erro na sessão; ApiError 4xx não é relatado.
 */
const LIMIT = 5;
const WINDOW_MS = 60_000;
const SEEN_KEY = "arremate.erros.relatados";
let sentAt: number[] = [];

export type ClientErrorReport = { name: string; message: string; stack?: string; url?: string; digest?: string };

export function shouldReport(error: unknown): boolean {
  if (error instanceof ApiError) return error.statusCode >= 500 && error.code !== "CONFIRMATION_PENDING";
  return true;
}

export function toReport(error: unknown, digest?: string): ClientErrorReport {
  const base = error instanceof Error ? { name: error.name || "Error", message: error.message || "Erro sem mensagem", stack: error.stack?.slice(0, 4000) } : { name: "Error", message: String(error).slice(0, 500) };
  return { ...base, message: base.message.slice(0, 500), url: typeof window === "undefined" ? undefined : `${window.location.origin}${window.location.pathname}`, digest };
}

export function allowReport(key: string, now = Date.now()): boolean {
  sentAt = sentAt.filter((at) => now - at < WINDOW_MS);
  if (sentAt.length >= LIMIT) return false;
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
    if (seen.has(key)) return false;
    seen.add(key);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50)));
  } catch {
    /* sem storage: vale só o limite em memória */
  }
  sentAt.push(now);
  return true;
}

export function reportClientError(error: unknown, digest?: string): void {
  if (typeof window === "undefined" || !shouldReport(error)) return;
  const report = toReport(error, digest);
  if (!allowReport(`${report.name}|${report.message}|${report.url ?? ""}`)) return;
  const body = JSON.stringify(report);
  try {
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }));
    if (!sent) void fetch("/api/client-errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin" }).catch(() => undefined);
  } catch {
    /* relato nunca derruba a página */
  }
}

/** Só para testes. */
export function resetReporterForTests(): void {
  sentAt = [];
}
