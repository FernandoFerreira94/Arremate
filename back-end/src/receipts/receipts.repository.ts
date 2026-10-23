import { DatabaseRepository } from "../database/database.repository";

export type ReceiptRow = {
  lot_id: string;
  external_id: string;
  title: string;
  attributes: Record<string, unknown>;
  credit: string;
  license: string;
  media_key: string;
  winner_alias: string;
  amount_cents: string;
  starts_at: Date;
  ends_at: Date;
  settled_at: Date;
};

export class ReceiptsRepository {
  constructor(private readonly database: DatabaseRepository) {}

  async findByToken(token: string): Promise<ReceiptRow | null> {
    const result = await this.database.query<ReceiptRow>(
      `SELECT l.id AS lot_id, s.external_id, s.title, s.attributes, s.credit, s.license, s.media_key,
              b.alias AS winner_alias, b.amount_cents::text AS amount_cents, l.starts_at, l.ends_at, st.settled_at
       FROM receipts r
       JOIN settlements st ON st.id = r.settlement_id
       JOIN lots l ON l.id = st.lot_id
       JOIN catalog_item_snapshots s ON s.id = l.snapshot_id
       JOIN bids b ON b.id = st.winner_bid_id
       WHERE r.public_token = $1`,
      [token],
    );
    return result.rows[0] ?? null;
  }
}
