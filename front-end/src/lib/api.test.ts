import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api-error";
import { apiFetch, clearCsrfMemory } from "./api";

afterEach(() => {
  clearCsrfMemory();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cliente da API", () => {
  it("envia a sessão same-origin e o CSRF só em mutação, sem storage", async () => {
    const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (url.endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-de-teste" }), { status: 200 });
      }
      return new Response(JSON.stringify({ role: "BIDDER", returnTo: "/" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/auth/me");
    await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@example.com", password: "segredo" }) });

    const getCall = fetchMock.mock.calls[0];
    expect(getCall?.[1]).toMatchObject({ credentials: "same-origin", cache: "no-store" });
    expect(new Headers(getCall?.[1]?.headers).has("X-CSRF-Token")).toBe(false);
    const postCall = fetchMock.mock.calls.at(-1);
    expect(postCall?.[1]).toMatchObject({ credentials: "same-origin" });
    expect(new Headers(postCall?.[1]?.headers).get("X-CSRF-Token")).toBe("csrf-de-teste");
    expect(postCall?.[1]?.headers && new Headers(postCall?.[1].headers).has("Authorization")).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it("expõe code e requestId e não registra o corpo", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/auth/csrf")) {
        return new Response(JSON.stringify({ csrfToken: "csrf-de-teste" }), { status: 200 });
      }
      return new Response(JSON.stringify({
        statusCode: 403,
        code: "CSRF_RECUSADO",
        message: "Não foi possível confirmar esta requisição.",
        requestId: "req-1",
      }), { status: 403 });
    }));
    clearCsrfMemory();
    await expect(apiFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ password: "nao-logar" }),
    })).rejects.toMatchObject({
      name: "ApiError",
      statusCode: 403,
      code: "CSRF_RECUSADO",
      requestId: "req-1",
      message: "Não foi possível confirmar esta requisição.",
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.join(" ")).not.toContain("nao-logar");
  });

  it("converte tempo esgotado em erro pt-BR", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const abort = new Error("aborted");
        abort.name = "AbortError";
        reject(abort);
      });
    }));
    const error = await apiFetch("/api/auth/me", { timeoutMs: 20 }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "TEMPO_ESGOTADO", message: "A conexão demorou demais. Tente de novo." });
  });
});
