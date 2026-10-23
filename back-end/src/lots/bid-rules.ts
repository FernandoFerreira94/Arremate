export const ANTI_SNIPING_MS = 120_000;

export type BidRejectionCode =
  | "BID_BELOW_MINIMUM"
  | "INSUFFICIENT_FUNDS"
  | "ALREADY_LEADING"
  | "LOT_NOT_STARTED"
  | "LOT_ENDED"
  | "LOT_CANCELLED";

export class BidRejection extends Error {
  constructor(readonly code: BidRejectionCode) {
    super(code);
    this.name = "BidRejection";
  }
}

export type BidContext = {
  status: string;
  startsAt: Date;
  endsAt: Date;
  initialCents: bigint;
  incrementCents: bigint;
  currentCents: bigint | null;
  actorIsLeader: boolean;
  availableCents: bigint;
  amountCents: bigint;
  /** Relógio do banco lido depois dos locks; o relógio do cliente nunca decide. */
  now: Date;
};

export type BidDecision = { endsAt: Date; extended: boolean };

export function minimumNext(initialCents: bigint, incrementCents: bigint, currentCents: bigint | null): bigint {
  return currentCents === null ? initialCents : currentCents + incrementCents;
}

/** Decisão pura do lance; não muda nada se recusar. */
export function decideBid(input: BidContext): BidDecision {
  const now = input.now.getTime();
  if (input.status === "CANCELLED") throw new BidRejection("LOT_CANCELLED");
  if (input.status !== "PUBLISHED" || now >= input.endsAt.getTime()) throw new BidRejection("LOT_ENDED");
  if (now < input.startsAt.getTime()) throw new BidRejection("LOT_NOT_STARTED");
  if (input.actorIsLeader) throw new BidRejection("ALREADY_LEADING");
  if (input.amountCents < minimumNext(input.initialCents, input.incrementCents, input.currentCents)) {
    throw new BidRejection("BID_BELOW_MINIMUM");
  }
  if (input.availableCents < input.amountCents) throw new BidRejection("INSUFFICIENT_FUNDS");
  const remaining = input.endsAt.getTime() - now;
  if (remaining < ANTI_SNIPING_MS) return { endsAt: new Date(now + ANTI_SNIPING_MS), extended: true };
  return { endsAt: input.endsAt, extended: false };
}
