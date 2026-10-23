import { CatalogError, isPrivateAddress, MetCatalogClient, retryAfterMs, safeUrl } from "../src/catalog/met-catalog.client";
import { FakeMet, fixture, json, metObject } from "./support/met-fake";

function client(fake: FakeMet, extra: { now?: () => number; sleeps?: number[] } = {}) {
  return new MetCatalogClient({
    fetch: fake.fetch,
    lookup: fake.lookup,
    now: extra.now,
    sleep: async (ms) => {
      extra.sleeps?.push(ms);
    },
  });
}

async function codeOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    if (error instanceof CatalogError) return error.code;
    throw error;
  }
  return "OK";
}

describe("MetCatalogClient", () => {
  it("lê a busca v1.1 real gravada e envia hasImages/offset/limit", async () => {
    const fake = new FakeMet();
    fake.search(fixture("search-sunflowers.json"));
    const met = client(fake);
    const result = await met.search("sunflowers", 8, 8, met.newBudget());
    expect(result.total).toBe(153);
    expect(result.objectIDs).toHaveLength(8);
    const url = new URL(fake.calls[0] ?? "");
    expect(url.pathname).toBe("/public/collection/v1.1/search");
    expect(url.searchParams.get("hasImages")).toBe("true");
    expect(url.searchParams.get("offset")).toBe("8");
    expect(url.searchParams.get("limit")).toBe("8");
  });

  it("recusa esquema inválido da busca e do objeto", async () => {
    const fake = new FakeMet();
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1.1/search", () => json({ total: "3", objectIDs: [1] }));
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/5", () => json({ objectID: 5, isPublicDomain: "yes" }));
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/6", () => new Response("<html>", { status: 200 }));
    const met = client(fake);
    expect(await codeOf(met.search("x", 0, 8, met.newBudget()))).toBe("PROVEDOR_RESPOSTA_INVALIDA");
    expect(await codeOf(met.object(5, met.newBudget()))).toBe("PROVEDOR_RESPOSTA_INVALIDA");
    expect(await codeOf(met.object(6, met.newBudget()))).toBe("PROVEDOR_RESPOSTA_INVALIDA");
  });

  it("recusa objeto cujo id não confere", async () => {
    const fake = new FakeMet();
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/7", () => json(metObject(8)));
    const met = client(fake);
    expect(await codeOf(met.object(7, met.newBudget()))).toBe("PROVEDOR_RESPOSTA_INVALIDA");
  });

  it("devolve null em 404", async () => {
    const met = client(new FakeMet());
    await expect(met.object(9, met.newBudget())).resolves.toBeNull();
  });

  it("tenta uma vez de novo após 429 respeitando Retry-After", async () => {
    const fake = new FakeMet();
    let calls = 0;
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/10", () => {
      calls += 1;
      return calls === 1 ? new Response("", { status: 429, headers: { "retry-after": "2" } }) : json(metObject(10));
    });
    const sleeps: number[] = [];
    const met = client(fake, { sleeps });
    const item = await met.object(10, met.newBudget());
    expect(item?.objectID).toBe(10);
    expect(sleeps).toEqual([2000]);
    expect(calls).toBe(2);
  });

  it("não passa de uma nova tentativa e não espera além do orçamento", async () => {
    const fake = new FakeMet();
    let calls = 0;
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/11", () => {
      calls += 1;
      return new Response("", { status: 429, headers: { "retry-after": "1" } });
    });
    const met = client(fake);
    expect(await codeOf(met.object(11, met.newBudget()))).toBe("PROVEDOR_INDISPONIVEL");
    expect(calls).toBe(2);
    calls = 0;
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/12", () => {
      calls += 1;
      return new Response("", { status: 429, headers: { "retry-after": "30" } });
    });
    expect(await codeOf(met.object(12, met.newBudget()))).toBe("PROVEDOR_INDISPONIVEL");
    expect(calls).toBe(1);
  });

  it("passa sinal de timeout, tenta uma vez de novo e converte timeout em indisponível", async () => {
    const fake = new FakeMet();
    const signals: (AbortSignal | null | undefined)[] = [];
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/13", (_url, init) => {
      signals.push(init.signal);
      throw new DOMException("timeout", "TimeoutError");
    });
    const met = client(fake);
    expect(await codeOf(met.object(13, met.newBudget()))).toBe("PROVEDOR_INDISPONIVEL");
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
    const spent = { deadline: Date.now() - 1 };
    const before = fake.calls.length;
    expect(await codeOf(met.object(13, spent))).toBe("PROVEDOR_INDISPONIVEL");
    expect(fake.calls.length).toBe(before);
  });

  it("recusa redirecionamento sem segui-lo", async () => {
    const fake = new FakeMet();
    fake.routes.set("collectionapi.metmuseum.org/public/collection/v1/objects/14", () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    const met = client(fake);
    expect(await codeOf(met.object(14, met.newBudget()))).toBe("ORIGEM_RECUSADA");
    expect(fake.calls).toHaveLength(1);
  });

  it("recusa host fora da allowlist, http, porta e credenciais", async () => {
    const fake = new FakeMet();
    const met = client(fake);
    for (const url of [
      "https://evil.example/a.jpg",
      "http://images.metmuseum.org/a.jpg",
      "https://images.metmuseum.org:8443/a.jpg",
      "https://user:pw@images.metmuseum.org/a.jpg",
      "https://images.metmuseum.org.evil.example/a.jpg",
      "https://collectionapi.metmuseum.org/a.jpg",
    ]) {
      expect(await codeOf(met.image(url, met.newBudget()))).toBe("ORIGEM_RECUSADA");
    }
    expect(fake.calls).toHaveLength(0);
    expect(() => safeUrl("not a url")).toThrow(CatalogError);
  });

  it("recusa host que resolve para rede privada", async () => {
    const fake = new FakeMet();
    const met = new MetCatalogClient({ fetch: fake.fetch, lookup: async () => [{ address: "10.0.0.5", family: 4 }] });
    expect(await codeOf(met.image("https://images.metmuseum.org/a.jpg", met.newBudget()))).toBe("ORIGEM_RECUSADA");
    expect(fake.calls).toHaveLength(0);
  });

  it("classifica endereços privados e públicos", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "nonsense"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    for (const address of ["23.45.67.89", "8.8.8.8", "2606:4700::1111"]) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });

  it("corta imagem acima de 10 MiB pelo cabeçalho e pelo fluxo", async () => {
    const fake = new FakeMet();
    fake.routes.set("images.metmuseum.org/big.jpg", () => new Response("x", { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(11 * 1024 * 1024) } }));
    fake.routes.set("images.metmuseum.org/stream.jpg", () => new Response(new Uint8Array(10 * 1024 * 1024 + 1), { status: 200, headers: { "content-type": "image/jpeg" } }));
    const met = client(fake);
    expect(await codeOf(met.image("https://images.metmuseum.org/big.jpg", met.newBudget()))).toBe("IMAGEM_INVALIDA");
    expect(await codeOf(met.image("https://images.metmuseum.org/stream.jpg", met.newBudget()))).toBe("IMAGEM_INVALIDA");
  });

  it("interpreta Retry-After em segundos e data", () => {
    expect(retryAfterMs("3", 0)).toBe(3000);
    expect(retryAfterMs(new Date(5_000).toUTCString(), 1_000)).toBe(4000);
    expect(retryAfterMs(null, 0)).toBe(1000);
  });
});
