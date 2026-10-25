import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup() { vi.stubEnv("SITE_URL", "http://127.0.0.1:3310"); vi.stubEnv("API_PROXY_TARGET", "http://127.0.0.1:4310"); }

describe("404 antes do streaming", () => {
  it("rejeita ID inválido sem consultar a API", async () => {
    setup(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await proxy(new NextRequest("https://untrusted.example/lotes/invalido?secret=ficticio"));
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["", "/auditoria"])("lote ausente retorna404 sem repassar cookies: %s", async (suffix) => {
    setup(); const fetcher = vi.fn().mockResolvedValue(new Response(null, {status:404})); vi.stubGlobal("fetch", fetcher);
    const response = await proxy(new NextRequest("https://untrusted.example/lotes/" + id + suffix, {headers:{cookie:"session=fixture-only"}}));
    expect(response.status).toBe(404);
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:4310/api/lots/" + id, expect.objectContaining({cache:"no-store",redirect:"error"}));
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
  });
  it("lote existente segue sem expor o snapshot na resposta", async () => {
    setup(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({title:"Obra",artist:"Artista",email:"private@example.invalid"})));
    const response = await proxy(new NextRequest("https://untrusted.example/lotes/" + id));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(await response.text()).not.toContain("private@example.invalid");
  });
  it("falha temporária da API permite renderizar o tratamento de erro da tela", async () => {
    setup(); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const response = await proxy(new NextRequest("https://untrusted.example/lotes/" + id));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("valida só o formato do token e não consulta comprovantes no proxy", async () => {
    setup(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await proxy(new NextRequest("https://untrusted.example/comprovantes/curto"))).status).toBe(404);
    expect((await proxy(new NextRequest("https://untrusted.example/comprovantes/" + "a".repeat(32)))).headers.get("x-middleware-next")).toBe("1");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
