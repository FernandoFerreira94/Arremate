import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error";
import { isRuleRejection } from "./notify";

describe("isRuleRejection", () => {
  const failure = (statusCode: number, code: string) => new ApiError({ statusCode, code, message: "x", requestId: "abc" });

  it("recusas 4xx das regras de lance viram aviso", () => {
    for (const code of ["ALREADY_LEADING", "BID_BELOW_MINIMUM", "INSUFFICIENT_FUNDS", "LOT_ENDED"]) expect(isRuleRejection(failure(409, code))).toBe(true);
    expect(isRuleRejection(failure(400, "VALOR_INVALIDO"))).toBe(true);
  });

  it("5xx, erro de rede e erro inesperado continuam como erro com código", () => {
    expect(isRuleRejection(failure(500, "ERRO_INTERNO"))).toBe(false);
    expect(isRuleRejection(failure(503, "BANCO_INDISPONIVEL"))).toBe(false);
    expect(isRuleRejection(failure(0, "ERRO_INTERNO"))).toBe(false);
    expect(isRuleRejection(new Error("boom"))).toBe(false);
  });
});
