import type { PoolClient } from "pg";

export type LockedLot = {
  status: string;
  starts_at: Date;
  ends_at: Date;
  initial_cents: string;
  increment_cents: string;
  revision: number;
};

export type LeaderBid = { id: string; user_id: string; amount_cents: string };
export type LockedWallet = { id: string; user_id: string; total_cents: string; committed_cents: string; revision: number };

/** Todas as leituras decisórias usam o cliente da transação. */
export class BiddingRepository {
  async lockLot(client: PoolClient, lotId: string): Promise<LockedLot | null> {
    const result = await client.query<LockedLot>(
      `SELECT status::text AS status, starts_at, ends_at, initial_cents::text AS initial_cents,
              increment_cents::text AS increment_cents, revision
       FROM lots WHERE id = $1 FOR UPDATE`,
      [lotId],
    );
    return result.rows[0] ?? null;
  }

  async leader(client: PoolClient, lotId: string): Promise<LeaderBid | null> {
    const result = await client.query<LeaderBid>(
      `SELECT id, user_id, amount_cents::text AS amount_cents FROM bids WHERE lot_id = $1 ORDER BY sequence DESC LIMIT 1`,
      [lotId],
    );
    return result.rows[0] ?? null;
  }

  /** Trava as carteiras envolvidas sempre em ordem de ID para evitar deadlock entre lotes. */
  async lockWallets(client: PoolClient, userIds: readonly string[]): Promise<Map<string, LockedWallet>> {
    const result = await client.query<LockedWallet>(
      `SELECT id, user_id, total_cents::text AS total_cents, committed_cents::text AS committed_cents, revision
       FROM wallets WHERE user_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[...new Set(userIds)]],
    );
    return new Map(result.rows.map((row) => [row.user_id, row]));
  }

  async clock(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>(`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`);
    const now = result.rows[0]?.now;
    if (!now) throw new Error("relógio do banco indisponível");
    return now;
  }

  async aliasFor(client: PoolClient, lotId: string, userId: string): Promise<string> {
    const existing = await client.query<{ alias: string }>(`SELECT alias FROM bids WHERE lot_id = $1 AND user_id = $2 LIMIT 1`, [lotId, userId]);
    if (existing.rows[0]) return existing.rows[0].alias;
    const count = await client.query<{ n: number }>(`SELECT count(DISTINCT user_id)::int AS n FROM bids WHERE lot_id = $1`, [lotId]);
    return `Licitante ${(count.rows[0]?.n ?? 0) + 1}`;
  }

  async moveReservation(client: PoolClient, walletId: string, kind: "RESERVE" | "RELEASE", amount: bigint, reference: string): Promise<number> {
    await client.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, $2, $3, $4)`, [
      walletId,
      kind,
      amount.toString(),
      reference,
    ]);
    const delta = kind === "RESERVE" ? amount : -amount;
    const result = await client.query<{ revision: number }>(
      `UPDATE wallets SET committed_cents = committed_cents + $2::numeric, revision = revision + 1, updated_at = clock_timestamp()
       WHERE id = $1 RETURNING revision`,
      [walletId, delta.toString()],
    );
    const revision = result.rows[0]?.revision;
    if (revision === undefined) throw new Error("carteira não atualizada");
    return revision;
  }
}
