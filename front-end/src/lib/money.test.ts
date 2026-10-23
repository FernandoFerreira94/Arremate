import { describe, expect, it } from "vitest";
import { formatBrl, parseBrlInput } from "./money";

describe("valor em reais digitado vira centavos sem float", () => {
  it.each([
    ["1.500", "150000"],
    ["1500,00", "150000"],
    ["R$ 1500", "150000"],
    ["R$ 1.500,5", "150050"],
    ["0,10", "10"],
    ["999.999.999,99", "99999999999"],
    ["9999999999,99", "999999999999"],
  ])("%s → %s centavos", (text, cents) => {
    expect(parseBrlInput(text)).toEqual({ ok: true, cents });
  });

  it.each(["", "abc", "1,234", "-5", "1.50,00", "10000000000,00", "0,1,2"])("recusa %j", (text) => {
    expect(parseBrlInput(text).ok).toBe(false);
  });

  it("formata texto de centavos grandes sem perder precisão", () => {
    expect(formatBrl("123456789012345678")).toBe("R$ 1.234.567.890.123.456,78");
    expect(formatBrl("5")).toBe("R$ 0,05");
    expect(formatBrl("0")).toBe("R$ 0,00");
  });
});
