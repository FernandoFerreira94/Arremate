export type AuditStatus = "INTACT" | "TAMPERED" | "INDETERMINATE";

export type CanonicalBid = {
  lotId: string;
  bidId: string;
  bidderUserId: string;
  alias: string;
  sequence: number;
  amountCents: bigint;
  acceptedAt: string;
  previousSignature: string;
  keyVersion: number;
};

export type GenesisRecord = {
  lotId: string;
  ownerId: string;
  snapshotId: string;
  initialCents: bigint;
  incrementCents: bigint;
  startsAt: string;
  endsAt: string;
  keyVersion: number;
};

export type SettlementLink = {
  settlementId: string;
  winnerBidId: string | null;
  receiptToken: string | null;
  settledAt: string;
};

export type CheckpointBody = {
  lotId: string;
  revision: number;
  count: number;
  headSignature: string;
  genesisSignature: string;
  keyVersion: number;
  endsAt: string;
  ownerId: string;
  snapshotId: string;
  initialCents: bigint;
  incrementCents: bigint;
  startsAt: string;
  genesisEndsAt: string;
  settlement: SettlementLink | null;
  /** Cancelamento selado no envelope; ausente equivale a `false` e mantém os bytes dos envelopes antigos. */
  cancelled?: boolean;
};

export type Checkpoint = CheckpointBody & {
  envelopeSignature: string;
};

export type LotSnapshot = {
  lotId: string;
  ownerId: string;
  snapshotId: string;
  initialCents: bigint;
  incrementCents: bigint;
  startsAt: string;
  endsAt: string;
  revision: number;
  status: string;
};

export type StoredBid = {
  bidId: string;
  lotId: string;
  bidderUserId: string;
  alias: string;
  sequence: number;
  amountCents: bigint;
  acceptedAt: string;
  signature: string;
};

export type LotHistory = {
  lot: LotSnapshot | null;
  bids: StoredBid[];
  settlement: SettlementLink | null;
  ambiguous: boolean;
};

export type AuditResult = {
  status: AuditStatus;
  revision: number | null;
  count: number | null;
  verifiedAt: string;
  reasonCode: string;
  message: string;
};
