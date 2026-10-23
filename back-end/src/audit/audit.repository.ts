import type { Pool, PoolClient } from "pg";
import type { LotHistory, LotSnapshot, SettlementLink, StoredBid } from "./audit.types";

const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type BidCommit = {
  lotId: string;
  expectedRevision: number;
  nextRevision: number;
  endsAt: string;
  bidId: string;
  bidderUserId: string;
  alias: string;
  sequence: number;
  amountCents: bigint;
  acceptedAt: string;
  signature: string;
};

export class AuditRepository {
  private readonly schema: string;

  constructor(
    private readonly pool: Pool,
    schema: string,
  ) {
    if (!SCHEMA_NAME.test(schema)) {
      throw new Error("schema inválido");
    }
    this.schema = schema;
  }

  async loadHistory(lotId: string): Promise<LotHistory> {
    assertUuid(lotId);
    return this.withClient(async (client) => {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query(`SET LOCAL search_path TO ${this.schema}`);
      try {
        const history = await this.readHistory(client, lotId);
        await client.query("COMMIT");
        return history;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  private async readHistory(client: PoolClient, lotId: string): Promise<LotHistory> {
    const lot = await client.query(
      `SELECT id, owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at, revision
       FROM lots WHERE id = $1`,
      [lotId],
    );
    const bids = await client.query(
      `SELECT id, lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature
       FROM bids WHERE lot_id = $1 ORDER BY sequence`,
      [lotId],
    );
    const settlement = await client.query(
      `SELECT s.id, s.winner_bid_id, s.settled_at, r.public_token
       FROM settlements s
       LEFT JOIN receipts r ON r.settlement_id = s.id
       WHERE s.lot_id = $1`,
      [lotId],
    );
    const ambiguous = (lot.rowCount ?? 0) > 1 || (settlement.rowCount ?? 0) > 1;
    return {
      lot: ambiguous || !lot.rows[0] ? null : mapLot(lot.rows[0]),
      bids: ambiguous ? [] : bids.rows.map((row) => mapBid(row)),
      settlement: ambiguous || !settlement.rows[0] ? null : mapSettlement(settlement.rows[0]),
      ambiguous,
    };
  }

  async commitBid(input: BidCommit): Promise<void> {
    assertUuid(input.lotId);
    assertUuid(input.bidId);
    assertUuid(input.bidderUserId);
    await this.withClient(async (client) => {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${this.schema}`);
      try {
        await this.insertBid(client, input);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  /** Grava lance e revisão no cliente de uma transação externa (lance + carteira + idempotência). */
  async insertBid(client: PoolClient, input: BidCommit): Promise<void> {
    assertUuid(input.lotId);
    assertUuid(input.bidId);
    assertUuid(input.bidderUserId);
    await client.query(
      `INSERT INTO ${this.schema}.bids (id, lot_id, user_id, alias, sequence, amount_cents, accepted_at, signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [input.bidId, input.lotId, input.bidderUserId, input.alias, input.sequence, input.amountCents.toString(), input.acceptedAt, input.signature],
    );
    const updated = await client.query(`UPDATE ${this.schema}.lots SET revision = $2, ends_at = $3 WHERE id = $1 AND revision = $4`, [
      input.lotId,
      input.nextRevision,
      input.endsAt,
      input.expectedRevision,
    ]);
    if (updated.rowCount !== 1) {
      throw new Error("revisão do lote divergente");
    }
  }

  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.withClient(async (client) => {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${this.schema}`);
      try {
        const result = await action(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    });
  }

  private async withClient<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await action(client);
    } finally {
      client.release();
    }
  }
}

function mapLot(row: unknown): LotSnapshot {
  const record = asRecord(row);
  return {
    lotId: asUuid(record.id),
    ownerId: asUuid(record.owner_id),
    snapshotId: asUuid(record.snapshot_id),
    initialCents: asCents(record.initial_cents),
    incrementCents: asCents(record.increment_cents),
    startsAt: asInstant(record.starts_at),
    endsAt: asInstant(record.ends_at),
    revision: asInteger(record.revision),
  };
}

function mapBid(row: unknown): StoredBid {
  const record = asRecord(row);
  return {
    bidId: asUuid(record.id),
    lotId: asUuid(record.lot_id),
    bidderUserId: asUuid(record.user_id),
    alias: asText(record.alias),
    sequence: asInteger(record.sequence),
    amountCents: asCents(record.amount_cents),
    acceptedAt: asInstant(record.accepted_at),
    signature: asText(record.signature),
  };
}

function mapSettlement(row: unknown): SettlementLink {
  const record = asRecord(row);
  return {
    settlementId: asUuid(record.id),
    winnerBidId: record.winner_bid_id === null ? null : asUuid(record.winner_bid_id),
    receiptToken: record.public_token === null || record.public_token === undefined ? null : asText(record.public_token),
    settledAt: asInstant(record.settled_at),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("linha inválida");
  }
  return value as Record<string, unknown>;
}

function asUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new Error("identificador inválido");
  }
  return value;
}

function asText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("texto inválido");
  }
  return value;
}

function asInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error("inteiro inválido");
  }
  return value;
}

function asCents(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("centavos inválidos");
  }
  return BigInt(value);
}

function asInstant(value: unknown): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("instante inválido");
  }
  return value.toISOString();
}

function assertUuid(value: string): void {
  if (!UUID.test(value)) {
    throw new Error("identificador inválido");
  }
}
