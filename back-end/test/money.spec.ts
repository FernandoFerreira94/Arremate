import { MoneyError, formatMoney, parseMoney, parsePositiveMoney } from "../src/common/money";

const ENTRY_CEILING = 999999999999n;

describe("parseMoney", () => {
  it("converte texto de centavos inteiros", () => {
    expect(parseMoney("100")).toBe(100n);
    expect(parseMoney("0")).toBe(0n);
    expect(parseMoney(ENTRY_CEILING.toString())).toBe(ENTRY_CEILING);
  });

  it("rejeita decimal, notação científica, sinal, espaços e zeros à esquerda", () => {
    for (const value of ["1.00", "1e3", "-1", " 100", "100 ", "1 00", "+1", "01", "", "NaN", "1,00"]) {
      expect(() => parseMoney(value)).toThrow(MoneyError);
    }
  });

  it("rejeita tipo number", () => {
    expect(() => {
      // @ts-expect-error o contrato é texto; number precisa falhar em runtime
      return parseMoney(100);
    }).toThrow(MoneyError);
  });

  it("rejeita valor acima do teto por lançamento", () => {
    expect(() => parseMoney("1000000000000")).toThrow(MoneyError);
    try {
      parseMoney("1000000000000");
      throw new Error("deveria rejeitar o teto");
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyError);
      expect((error as MoneyError).code).toBe("MONEY_EXCEEDS_ENTRY_CEILING");
    }
  });
});

describe("formatMoney", () => {
  it("devolve o texto decimal do bigint", () => {
    expect(formatMoney(123n)).toBe("123");
    expect(formatMoney(0n)).toBe("0");
  });

  it("formata saldo acumulado acima do teto de lançamento", () => {
    expect(formatMoney(1200000000000n)).toBe("1200000000000");
  });

  it("rejeita negativo e tipo number", () => {
    expect(() => formatMoney(-1n)).toThrow(MoneyError);
    expect(() => {
      // @ts-expect-error o contrato é bigint; number precisa falhar em runtime
      return formatMoney(123);
    }).toThrow(MoneyError);
  });
});

describe("parsePositiveMoney", () => {
  it("aceita valor maior que zero dentro do teto", () => {
    expect(parsePositiveMoney("1")).toBe(1n);
    expect(parsePositiveMoney(ENTRY_CEILING.toString())).toBe(ENTRY_CEILING);
  });

  it("rejeita zero e as mesmas entradas inválidas do texto estrutural", () => {
    expect(() => parsePositiveMoney("0")).toThrow(MoneyError);
    try {
      parsePositiveMoney("0");
      throw new Error("deveria rejeitar zero");
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyError);
      expect((error as MoneyError).code).toBe("MONEY_MUST_BE_POSITIVE");
    }
    expect(() => parsePositiveMoney("1.00")).toThrow(MoneyError);
    expect(() => parsePositiveMoney("1000000000000")).toThrow(MoneyError);
  });
});
