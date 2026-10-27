import { formatBrl } from "../../lib/money";

export type PublicBid = { alias: string; amountCents: string; sequence: number; acceptedAt: string };

export function bidShortcuts(minimumCents: string, incrementCents: string): string[] {
  const min = BigInt(minimumCents);
  const inc = BigInt(incrementCents);
  return [min, min + inc, min + inc * BigInt(2)].map(String);
}

/** Diferença servidor − local no momento do snapshot. O contador só exibe; o aceite é do servidor. */
export function clockOffset(serverNowIso: string, localNowMs: number): number {
  return Date.parse(serverNowIso) - localNowMs;
}

export function remainingMs(targetIso: string, localNowMs: number, offset: number): number {
  return Math.max(0, Date.parse(targetIso) - (localNowMs + offset));
}

const two = (n: number) => String(n).padStart(2, "0");

export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return `${two(minutes)}:${two(seconds)}`;
}

export function rankByBidder(bids: PublicBid[]): Array<PublicBid & { position: number }> {
  const best = new Map<string, PublicBid>();
  for (const bid of bids) {
    const current = best.get(bid.alias);
    if (!current || BigInt(bid.amountCents) > BigInt(current.amountCents)) best.set(bid.alias, bid);
  }
  return [...best.values()]
    .sort((a, b) => (BigInt(b.amountCents) > BigInt(a.amountCents) ? 1 : BigInt(b.amountCents) < BigInt(a.amountCents) ? -1 : a.sequence - b.sequence))
    .map((bid, index) => ({ ...bid, position: index + 1 }));
}

/** QA MÉDIA 5: mensagem do lance acima do disponível, com quanto falta. */
export function insufficientBalanceMessage(bidCents: string, availableCents: string): string {
  const missing = BigInt(bidCents) - BigInt(availableCents);
  return `Saldo insuficiente: você tem ${formatBrl(availableCents)} disponível e faltam ${formatBrl(missing.toString())} para este lance.`;
}

/** QA N1: o "Lance confirmado" só vale enquanto ninguém cobriu o valor confirmado. */
export function confirmationHolds(confirmedCents: string, currentCents: string | null): boolean {
  return currentCents === null || BigInt(currentCents) <= BigInt(confirmedCents);
}

/** QA N4: toast na sala só na virada de liderando para superado (não ao abrir a sala já superado). */
export function becameOutbid(previous: string | null | undefined, next: string | null | undefined): boolean {
  return previous === "LEADING" && next === "OUTBID";
}
