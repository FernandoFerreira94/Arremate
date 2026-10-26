import { describe, expect, it } from "vitest";
import { validateDeposit } from "./deposit-rules";

describe("validateDeposit (QA MÉDIA 5)", () => {
  it("R$ 0 tem mensagem própria", () => {
    for (const text of ["0", "0,00", "R$ 0"]) {
      const result = validateDeposit(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/maior que zero/);
    }
  });
  it("faixa e valores válidos seguem como antes", () => {
    expect(validateDeposit("0,50")).toEqual({ ok: false, message: "Entre R$ 1,00 e R$ 100.000,00 por depósito." });
    expect(validateDeposit("1.000")).toEqual({ ok: true, cents: "100000" });
  });
});
