import type { PoolClient } from "pg";
import { DatabaseRepository } from "../database/database.repository";

export type SettlingLot = { id: string; owner_id: string; status: string; ends_at: Date; revision: number };
export type WinningBid = { id: string; user_id: string; alias: string; amount_cents: string };
export type SettlementWallet = { id: string; user_id: string };

export type ParticipationRow = {
  lot_id: string;
  title: string;
  media_key: string;
  status: string;
  ends_at: Date;
  my_top_cents: string;
  my_bids: { amountCents: string; acceptedAt: string }[];
  top_cents: string;
  i_lead: boolean;
  public_token: string | null;
  server_now: Date;
};

export type AwardRow = { lot_id: string; title: string; media_key: string; amount_cents: string; settled_at: Date; public_token: string };

/** Leituras decisÃƒÆ’Ã‚Â³rias e gravaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes da liquidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o; tudo no cliente transacional recebido. */
export class SettlementRepository {
  async lockLot(client: PoolClient, lotId: string): Promise<SettlingLot | null> {
    const result = await client.query<SettlingLot>(
      `SELECT id, owner_id, status::text AS status, ends_at, revision FROM lots WHERE id = $1 FOR UPDATE`,
      [lotId],
    );
    return result.rows[0] ?? null;
  }

  async winner(client: PoolClient, lotId: string): Promise<WinningBid | null> {
    const result = await client.query<WinningBid>(
      `SELECT id, user_id, alias, amount_cents::text AS amount_cents FROM bids WHERE lot_id = $1 ORDER BY sequence DESC LIMIT 1`,
      [lotId],
    );
    return result.rows[0] ?? null;
  }

  /** Garante a carteira do vendedor e trava as envolvidas em ordem de ID (mesma ordem do lance). */
  async lockWallets(client: PoolClient, userIds: readonly string[]): Promise<Map<string, SettlementWallet>> {
    const unique = [...new Set(userIds)];
    await client.query(`INSERT INTO wallets (user_id) SELECT unnest($1::uuid[]) ON CONFLICT (user_id) DO NOTHING`, [unique]);
    const result = await client.query<SettlementWallet>(`SELECT id, user_id FROM wallets WHERE user_id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`, [unique]);
    return new Map(result.rows.map((row) => [row.user_id, row]));
  }

  async clock(client: PoolClient): Promise<Date> {
    const result = await client.query<{ now: Date }>(`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`);
    const now = result.rows[0]?.now;
    if (!now) throw new Error("relÃƒÆ’Ã‚Â³gio do banco indisponÃƒÆ’Ã‚Â­vel");
    return now;
  }

  async debitWinner(client: PoolClient, walletId: string, amount: bigint, lotId: string): Promise<void> {
    await client.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, 'SETTLEMENT_DEBIT', $2, $3)`, [
      walletId,
      amount.toString(),
      `settle-debit:${lotId}`,
    ]);
    const updated = await client.query(
      `UPDATE wallets SET total_cents = total_cents - $2::numeric, committed_cents = committed_cents - $2::numeric,
              revision = revision + 1, updated_at = clock_timestamp()
       WHERE id = $1 AND committed_cents >= $2::numeric`,
      [walletId, amount.toString()],
    );
    if (updated.rowCount !== 1) throw new Error("reserva do vencedor nÃƒÆ’Ã‚Â£o confere");
  }

  async creditSeller(client: PoolClient, walletId: string, amount: bigint, lotId: string): Promise<void> {
    await client.query(`INSERT INTO wallet_entries (wallet_id, kind, amount_cents, reference) VALUES ($1, 'SETTLEMENT_CREDIT', $2, $3)`, [
      walletId,
      amount.toString(),
      `settle-credit:${lotId}`,
    ]);
    await client.query(`UPDATE wallets SET total_cents = total_cents + $2::numeric, revision = revision + 1, updated_at = clock_timestamp() WHERE id = $1`, [
      walletId,
      amount.toString(),
    ]);
  }

  async insertSettlement(client: PoolClient, settlementId: string, lotId: string, winnerBidId: string | null, settledAt: string): Promise<void> {
    await client.query(`INSERT INTO settlements (id, lot_id, winner_bid_id, settled_at) VALUES ($1, $2, $3, $4)`, [settlementId, lotId, winnerBidId, settledAt]);
  }

  async insertReceipt(client: PoolClient, settlementId: string, token: string): Promise<void> {
    await client.query(`INSERT INTO receipts (settlement_id, public_token) VALUES ($1, $2)`, [settlementId, token]);
  }

  async closeLot(client: PoolClient, lotId: string, status: "SETTLED" | "CLOSED_NO_BIDS", expectedRevision: number, revision: number): Promise<void> {
    const updated = await client.query(`UPDATE lots SET status = $2::lot_status, revision = $4 WHERE id = $1 AND revision = $3 AND status = 'PUBLISHED'`, [
      lotId,
      status,
      expectedRevision,
      revision,
    ]);
    if (updated.rowCount !== 1) throw new Error("lote mudou durante a liquidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o");
  }

  async dueLots(database: DatabaseRepository, limit: number): Promise<string[]> {
    const result = await database.query<{ id: string }>(
      `SELECT id FROM lots WHERE status = 'PUBLISHED' AND ends_at <= clock_timestamp() ORDER BY ends_at, id LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => row.id);
  }

  async participations(database: DatabaseRepository, userId: string, limit: number, offset: number): Promise<{ rows: ParticipationRow[]; total: number }> {
    const rows = await database.query<ParticipationRow>(
      `SELECT l.id AS lot_id, s.title, s.media_key, l.status::text AS status, l.ends_at,
              mine.top::text AS my_top_cents, mine.my_bids, top.amount_cents::text AS top_cents, top.user_id = $1 AS i_lead,
              CASE WHEN l.status = 'SETTLED' AND top.user_id = $1 THEN r.public_token END AS public_token,
              clock_timestamp() AS server_now
       FROM (SELECT lot_id, max(amount_cents) AS top, max(accepted_at) AS last_at, jsonb_agg(jsonb_build_object('amountCents', amount_cents::text, 'acceptedAt', accepted_at) ORDER BY sequence) AS my_bids FROM bids WHERE user_id = $1 GROUP BY lot_id) mine
       JOIN lots l ON l.id = mine.lot_id
       JOIN catalog_item_snapshots s ON s.id = l.snapshot_id
       JOIN LATERAL (SELECT user_id, amount_cents FROM bids WHERE lot_id = l.id ORDER BY sequence DESC LIMIT 1) top ON true
       LEFT JOIN settlements st ON st.lot_id = l.id
       LEFT JOIN receipts r ON r.settlement_id = st.id
       ORDER BY l.ends_at DESC, l.id LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    const total = await database.query<{ n: number }>(`SELECT count(DISTINCT lot_id)::int AS n FROM bids WHERE user_id = $1`, [userId]);
    return { rows: rows.rows, total: total.rows[0]?.n ?? 0 };
  }

  async awards(database: DatabaseRepository, userId: string, limit: number, offset: number): Promise<{ rows: AwardRow[]; total: number }> {
    const from = `FROM settlements st JOIN bids b ON b.id = st.winner_bid_id JOIN lots l ON l.id = st.lot_id
       JOIN catalog_item_snapshots s ON s.id = l.snapshot_id JOIN receipts r ON r.settlement_id = st.id
       WHERE b.user_id = $1 AND l.status = 'SETTLED'`;
    const rows = await database.query<AwardRow>(
      `SELECT l.id AS lot_id, s.title, s.media_key, b.amount_cents::text AS amount_cents, st.settled_at, r.public_token
       ${from} ORDER BY st.settled_at DESC, l.id LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    const total = await database.query<{ n: number }>(`SELECT count(*)::int AS n ${from}`, [userId]);
    return { rows: rows.rows, total: total.rows[0]?.n ?? 0 };
  }

  async sellerSummary(database: DatabaseRepository, ownerId: string) {
    const result = await database.query<{ credit: string; settled: number; no_bids: number; open: number; pending: number; cancelled: number }>(
      `SELECT COALESCE(SUM(b.amount_cents) FILTER (WHERE l.status = 'SETTLED'), 0)::text AS credit,
              count(*) FILTER (WHERE l.status = 'SETTLED')::int AS settled,
              count(*) FILTER (WHERE l.status = 'CLOSED_NO_BIDS')::int AS no_bids,
              count(*) FILTER (WHERE l.status = 'PUBLISHED' AND l.ends_at > clock_timestamp())::int AS open,
              count(*) FILTER (WHERE l.status IN ('PUBLISHED', 'CLOSED_PENDING') AND l.ends_at <= clock_timestamp())::int AS pending,
              count(*) FILTER (WHERE l.status = 'CANCELLED')::int AS cancelled
       FROM lots l LEFT JOIN settlements st ON st.lot_id = l.id LEFT JOIN bids b ON b.id = st.winner_bid_id
       WHERE l.owner_id = $1`,
      [ownerId],
    );
    return result.rows[0] ?? { credit: "0", settled: 0, no_bids: 0, open: 0, pending: 0, cancelled: 0 };
  }
}
