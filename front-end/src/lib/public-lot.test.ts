import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicLotMeta } from "./public-lot";

const id = "00000000-0000-4000-8000-000000000001";
const media = "/api/media/" + "a".repeat(64) + ".jpg";
afterEach(() => vi.unstubAllGlobals());

describe("metadados públicos do lote", () => {
  it("inclui só imagem local validada e não repassa campos privados ou financeiros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ title: "Obra", artist: "Artista", imageUrl: media, currentCents: "999", email: "private@example.invalid" })));
    expect(await fetchPublicLotMeta(id)).toEqual({ title: "Obra", artist: "Artista", imageUrl: media });
  });
  it.each(["http://169.254.169.254/secret", "/api/auth/me", "/api/media/file.svg", media + "?x=1"])("descarta imagem fora da mídia validada: %s", async (imageUrl) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ title: "Obra", artist: "Artista", imageUrl })));
    expect(await fetchPublicLotMeta(id)).toEqual({ title: "Obra", artist: "Artista", imageUrl: null });
  });
  it("ID inválido não consulta a API", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchPublicLotMeta("../private")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
