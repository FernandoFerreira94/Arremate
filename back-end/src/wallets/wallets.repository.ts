import { ApiException } from "../auth/api.exception";
import type { PoolClient } from "pg";
import { DatabaseRepository } from "../database/database.repository";

export type TestCard = { id: string; brand: string; last4: string; expiryMonth: number; expiryYear: number };
const CARD_COLUMNS = `id, brand, last4, expiry_month AS "expiryMonth", expiry_year AS "expiryYear"`;

export type WalletRow = { id: string; total_cents: string; committed_cents: string; revision: number };

export class WalletsRepository {
  constructor(private readonly database: DatabaseRepository) {}

  async cards(userId: string): Promise<{ items: TestCard[] }> {
    const result = await this.database.query<TestCard>(`SELECT ${CARD_COLUMNS} FROM test_cards WHERE user_id=$1`, [userId]);
    return { items: result.rows };
  }

  async saveTestCard(userId: string): Promise<TestCard> {
    const result = await this.database.query<TestCard>(
      `INSERT INTO test_cards (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING ${CARD_COLUMNS}`, [userId],
    );
    return result.rows[0];
  }

  async removeCard(userId: string, cardId: string): Promise<void> {
    const result = await this.database.query(`DELETE FROM test_cards WHERE user_id=$1 AND id=$2`, [userId, cardId]);
    if (result.rowCount !== 1) throw new ApiException(404, "NAO_ENCONTRADO");
  }

  async requireCard(client: PoolClient, userId: string, cardId: string): Promise<void> {
    const result = await client.query(`SELECT id FROM test_cards WHERE user_id=$1 AND id=$2 FOR SHARE`, [userId, cardId]);
    if (result.rowCount !== 1) throw new ApiException(404, "NAO_ENCONTRADO");
  }

  async entries(userId: string, page: number, filter: string) {
    const kinds = filter === "deposits" ? ["DEPOSIT"] : filter === "bids" ? ["RESERVE", "RELEASE"] : filter === "awards" ? ["SETTLEMENT_DEBIT", "SETTLEMENT_CREDIT"] : null;
    const from = `FROM wallet_entries e JOIN wallets w ON w.id=e.wallet_id WHERE w.user_id=$1 AND ($2::text[] IS NULL OR e.kind::text=ANY($2::text[]))`;
    const rows = await this.database.query<{ id: string; kind: string; amountCents: string; method: string | null; last4: string | null; createdAt: Date; reference: string }>(
      `SELECT e.id,e.kind::text AS kind,e.amount_cents::text AS "amountCents",e.method,e.card_last4 AS last4,e.created_at AS "createdAt",e.reference ${from} ORDER BY e.created_at DESC,e.id LIMIT 8 OFFSET $3`, [userId, kinds, (page-1)*8],
    );
    const total = await this.database.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, [userId, kinds]);
    return { items: rows.rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), page, pageSize: 8, total: total.rows[0]?.n ?? 0 };
  }

  async find(userId: string): Promise<WalletRow | null> {
    const result = await this.database.query<WalletRow>(
      `SELECT id, total_cents::text AS total_cents, committed_cents::text AS committed_cents, revision FROM wallets WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async lockOrCreate(client: PoolClient, userId: string): Promise<WalletRow> {
    await client.query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const result = await client.query<WalletRow>(
      `SELECT id, total_cents::text AS total_cents, committed_cents::text AS committed_cents, revision FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) throw new Error("carteira não encontrada após criação");
    return row;
  }

  async credit(client: PoolClient, walletId: string, amount: bigint, reference: string, method: "PIX" | "CARD" = "PIX"): Promise<WalletRow> {
    await client.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference, method, card_last4) VALUES ($1, 'DEPOSIT', $2, $3, $4, $5)`, [
      walletId,
      amount.toString(),
      reference,
      method,
      method === "CARD" ? "4242" : null,
    ]);
    await this.afterLedger();
    const result = await client.query<WalletRow>(
      `UPDATE wallets SET total_cents = total_cents + $2::numeric, revision = revision + 1, updated_at = clock_timestamp()
       WHERE id = $1
       RETURNING id, total_cents::text AS total_cents, committed_cents::text AS committed_cents, revision`,
      [walletId, amount.toString()],
    );
    const row = result.rows[0];
    if (!row) throw new Error("carteira não atualizada");
    return row;
  }

  protected async afterLedger(): Promise<void> {
    // ponto de falha controlada nos testes de rollback
  }
}
