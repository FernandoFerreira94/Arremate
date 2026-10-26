import { parseBrlInput } from "@/lib/money";

const MIN_DEPOSIT = BigInt(100);
const MAX_DEPOSIT = BigInt(10000000);


export function validateDeposit(text: string): { ok: true; cents: string } | { ok: false; message: string } {
  const parsed = parseBrlInput(text);
  if (!parsed.ok) return parsed;
  const cents = BigInt(parsed.cents);
  if (cents < MIN_DEPOSIT || cents > MAX_DEPOSIT) return { ok: false, message: "Entre R$ 1,00 e R$ 100.000,00 por depósito." };
  return parsed;
}

