import { describe, expect, it } from "vitest";
import { searchHref } from "./lot-search-logic";

describe("searchHref", () => {
  it("na vitrine mantém a aba, troca o termo e volta para a página 1", () => {
    expect(searchHref("  monet   azul ", new URLSearchParams("aba=agendados&page=3&q=velho"), true)).toBe("/?aba=agendados&q=monet+azul");
  });
  it("fora da vitrine não carrega parâmetros da página atual", () => {
    expect(searchHref("retrato", new URLSearchParams("aba=pix"), false)).toBe("/?q=retrato");
  });
  it("termo vazio limpa a busca", () => {
    expect(searchHref("   ", new URLSearchParams("q=x"), true)).toBe("/");
  });
});
