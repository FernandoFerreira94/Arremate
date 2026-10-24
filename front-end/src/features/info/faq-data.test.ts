import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, filterFaq } from "./faq-data";

describe("filterFaq", () => {
  it("filtra por categoria", () => expect(filterFaq(FAQ_ITEMS, "", "carteira").every((i) => i.category === "carteira")).toBe(true));
  it("busca sem acento e sem caixa", () => expect(filterFaq(FAQ_ITEMS, "PRORROGACAO", "todas").map((i) => i.id)).toContain("prorrogacao"));
  it("busca vazia devolve tudo", () => expect(filterFaq(FAQ_ITEMS, "  ", "todas")).toHaveLength(FAQ_ITEMS.length));
  it("sem resultado", () => expect(filterFaq(FAQ_ITEMS, "xyzzy", "todas")).toEqual([]));
});
