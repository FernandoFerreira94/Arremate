import { ApiError, toApiError } from "./api-error";

let csrfToken: string | null = null;

export function clearCsrfMemory(): void {
  csrfToken = null;
}

export async function apiFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<unknown> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD" && !csrfToken) await refreshCsrf();
  if (method !== "GET" && method !== "HEAD") headers.set("X-CSRF-Token", csrfToken ?? "");
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    const response = await fetch(path, {
      method,
      headers,
      body: init.body,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 8000),
    });
    if (path.endsWith("/auth/login") || path.endsWith("/auth/logout")) clearCsrfMemory();
    if (response.status === 204) return null;
    const text = await response.text();
    const parsed = text.length > 0 ? parseJson(text) : null;
    if (!response.ok) throw toApiError(response.status, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError({
        statusCode: 0,
        code: "TEMPO_ESGOTADO",
        message: "A conexão demorou demais. Tente de novo.",
        requestId: "",
      });
    }
    throw new ApiError({
      statusCode: 0,
      code: "ERRO_REDE",
      message: "Não foi possível concluir a operação.",
      requestId: "",
    });
  }
}

async function refreshCsrf(): Promise<void> {
  const response = await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin", cache: "no-store" });
  const text = await response.text();
  const parsed = text.length > 0 ? parseJson(text) : null;
  if (!response.ok || !isCsrf(parsed)) throw toApiError(response.status, parsed);
  csrfToken = parsed.csrfToken;
}

function isCsrf(body: unknown): body is { csrfToken: string } {
  return typeof body === "object" && body !== null && "csrfToken" in body && typeof body.csrfToken === "string" && body.csrfToken.length > 0;
}

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return null;
  }
}
