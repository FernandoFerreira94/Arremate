/** Teto por lançamento, igual ao back (centavos). */
export const MAX_ENTRY_CENTS = BigInt("999999999999");

export type ParsedMoney = { ok: true; cents: string } | { ok: false; message: string };

const INVALID: ParsedMoney = { ok: false, message: "Valor inválido. Use, por exemplo, 1.500 ou 1500,00." };

/**
 * Aceita "1.500", "1500,00", "R$ 1500" (Postel) e devolve centavos em texto.
 * Só manipula texto e BigInt; nunca usa Number para dinheiro.
 */
export function parseBrlInput(raw: string): ParsedMoney {
  const text = raw.replace(/^\s*R\$\s*/i, "").replace(/\s+/g, "");
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return INVALID;
  const reais = match[1].replace(/\./g, "");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = BigInt(reais) * BigInt(100) + BigInt(fraction);
  if (cents > MAX_ENTRY_CENTS) return { ok: false, message: "Valor acima do limite permitido." };
  return { ok: true, cents: cents.toString() };
}

/** Formata texto de centavos (inteiro não negativo) como BRL, sem float. */
export function formatBrl(centsText: string): string {
  if (!/^(0|[1-9][0-9]*)$/.test(centsText)) return "—";
  const padded = centsText.padStart(3, "0");
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const grouped = reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped},${padded.slice(-2)}`;
}
