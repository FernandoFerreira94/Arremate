import type { PoolClient } from "pg";
import { DatabaseRepository } from "../database/database.repository";

export type WalletRow = { id: string; total_cents: string; committed_cents: string; revision: number };

export class WalletsRepository {
  constructor(private readonly database: DatabaseRepository) {}

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

  async credit(client: PoolClient, walletId: string, amount: bigint, reference: string): Promise<WalletRow> {
    await client.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, 'DEPOSIT', $2, $3)`, [
      walletId,
      amount.toString(),
      reference,
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
