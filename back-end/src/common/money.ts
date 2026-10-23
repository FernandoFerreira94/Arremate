export type MoneyText = string;

export const ENTRY_CENTS_CEILING = 999999999999n;

const MONEY_TEXT = /^(0|[1-9][0-9]*)$/;

export class MoneyError extends Error {
  readonly code: "INVALID_MONEY" | "MONEY_EXCEEDS_ENTRY_CEILING" | "MONEY_MUST_BE_POSITIVE";

  constructor(code: MoneyError["code"]) {
    super(code);
    this.name = "MoneyError";
    this.code = code;
  }
}

export function parseMoney(value: string): bigint {
  if (typeof value !== "string" || !MONEY_TEXT.test(value)) {
    throw new MoneyError("INVALID_MONEY");
  }
  const amount = BigInt(value);
  if (amount > ENTRY_CENTS_CEILING) {
    throw new MoneyError("MONEY_EXCEEDS_ENTRY_CEILING");
  }
  return amount;
}

export function parsePositiveMoney(value: string): bigint {
  const amount = parseMoney(value);
  if (amount <= 0n) {
    throw new MoneyError("MONEY_MUST_BE_POSITIVE");
  }
  return amount;
}

export function formatMoney(value: bigint): MoneyText {
  if (typeof value !== "bigint" || value < 0n) {
    throw new MoneyError("INVALID_MONEY");
  }
  return value.toString();
}
