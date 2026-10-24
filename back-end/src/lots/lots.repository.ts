import { DatabaseRepository } from "../database/database.repository";

export const LOT_COLUMNS = `
  l.id, l.initial_cents::text AS initial_cents, l.increment_cents::text AS increment_cents,
  l.starts_at, l.ends_at, l.status::text AS status,
  l.estimate_low_cents::text AS estimate_low_cents, l.estimate_high_cents::text AS estimate_high_cents, l.condition_report,
  s.external_id, s.title, s.attributes, s.credit, s.license, s.media_key,
  b.top::text AS current_cents, COALESCE(b.n, 0)::int AS bid_count,
  clock_timestamp() AS server_now`;

const LOT_FROM = `
  FROM lots l
  JOIN catalog_item_snapshots s ON s.id = l.snapshot_id
  LEFT JOIN LATERAL (SELECT max(amount_cents) AS top, count(*) AS n FROM bids WHERE lot_id = l.id) b ON true`;

const SHOWCASE_ORDER = `
  ORDER BY
    CASE WHEN l.starts_at <= clock_timestamp() AND l.ends_at > clock_timestamp() THEN 0
         WHEN l.starts_at > clock_timestamp() THEN 1 ELSE 2 END,
    CASE WHEN l.ends_at > clock_timestamp() THEN l.ends_at END ASC,
    l.ends_at DESC, l.id`;

export type LotRow = {
  id: string;
  initial_cents: string;
  increment_cents: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  estimate_low_cents: string | null;
  estimate_high_cents: string | null;
  condition_report: string | null;
  external_id: string;
  title: string;
  attributes: Record<string, unknown>;
  credit: string;
  license: string;
  media_key: string;
  current_cents: string | null;
  bid_count: number;
  server_now: Date;
};

export type PublicBidRow = { alias: string; amount_cents: string; sequence: number; accepted_at: Date };

export class LotsRepository {
  constructor(private readonly database: DatabaseRepository) {}

  async showcase(limit: number, offset: number): Promise<{ rows: LotRow[]; total: number }> {
    const rows = await this.database.query<LotRow>(
      `SELECT ${LOT_COLUMNS} ${LOT_FROM} WHERE l.status <> 'CANCELLED' ${SHOWCASE_ORDER} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = await this.database.query<{ n: number }>(`SELECT count(*)::int AS n FROM lots WHERE status <> 'CANCELLED'`);
    return { rows: rows.rows, total: total.rows[0]?.n ?? 0 };
  }

  async ownedBy(ownerId: string, limit: number, offset: number): Promise<{ rows: LotRow[]; total: number }> {
    const rows = await this.database.query<LotRow>(
      `SELECT ${LOT_COLUMNS} ${LOT_FROM} WHERE l.owner_id = $1 ORDER BY l.created_at DESC, l.id LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset],
    );
    const total = await this.database.query<{ n: number }>(`SELECT count(*)::int AS n FROM lots WHERE owner_id = $1`, [ownerId]);
    return { rows: rows.rows, total: total.rows[0]?.n ?? 0 };
  }

  async find(id: string): Promise<LotRow | null> {
    const result = await this.database.query<LotRow>(`SELECT ${LOT_COLUMNS} ${LOT_FROM} WHERE l.id = $1`, [id]);
    return result.rows[0] ?? null;
  }

  async bids(lotId: string, limit: number, offset: number): Promise<{ rows: PublicBidRow[]; total: number }> {
    const rows = await this.database.query<PublicBidRow>(
      `SELECT alias, amount_cents::text AS amount_cents, sequence, accepted_at FROM bids WHERE lot_id = $1 ORDER BY sequence DESC LIMIT $2 OFFSET $3`,
      [lotId, limit, offset],
    );
    const total = await this.database.query<{ n: number }>(`SELECT count(*)::int AS n FROM bids WHERE lot_id = $1`, [lotId]);
    return { rows: rows.rows, total: total.rows[0]?.n ?? 0 };
  }

  async clock(): Promise<Date> {
    const result = await this.database.query<{ now: Date }>(`SELECT clock_timestamp() AS now`);
    const now = result.rows[0]?.now;
    if (!now) throw new Error("relógio do banco indisponível");
    return now;
  }
}
