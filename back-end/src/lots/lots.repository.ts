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

export type NotificationRow = {
  id: string;
  lot_id: string;
  kind: string;
  created_at: Date;
  read_at: Date | null;
  title: string;
  media_key: string;
  initial_cents: string;
};

/** D22: limite de notificações guardadas por usuário. */
export const NOTIFICATIONS_KEPT = 20;

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

  /** D22: favoritos do usuário; abertos/agendados primeiro (mais recentes antes), encerrados no fim. Cancelados ficam de fora. */
  async favorites(userId: string): Promise<LotRow[]> {
    const result = await this.database.query<LotRow>(
      `SELECT ${LOT_COLUMNS} ${LOT_FROM} JOIN favorites f ON f.lot_id = l.id AND f.user_id = $1
       WHERE l.status <> 'CANCELLED'
       ORDER BY CASE WHEN l.ends_at > clock_timestamp() AND l.status = 'PUBLISHED' THEN 0 ELSE 1 END, f.created_at DESC, l.id`,
      [userId],
    );
    return result.rows;
  }

  async addFavorite(userId: string, lotId: string): Promise<boolean> {
    const result = await this.database.query(
      `INSERT INTO favorites (user_id, lot_id) SELECT $1, l.id FROM lots l WHERE l.id = $2 AND l.status <> 'CANCELLED'
       ON CONFLICT (user_id, lot_id) DO NOTHING RETURNING lot_id`,
      [userId, lotId],
    );
    if ((result.rowCount ?? 0) > 0) return true;
    const exists = await this.database.query(`SELECT 1 FROM lots WHERE id = $1 AND status <> 'CANCELLED'`, [lotId]);
    return (exists.rowCount ?? 0) > 0;
  }

  async removeFavorite(userId: string, lotId: string): Promise<void> {
    await this.database.query(`DELETE FROM favorites WHERE user_id = $1 AND lot_id = $2`, [userId, lotId]);
  }

  /** D22 (H2): próximo lote agendado (o que abre primeiro). */
  async nextScheduled(): Promise<LotRow | null> {
    return (await this.upcoming(1))[0] ?? null;
  }

  /** D22 (H2b): até `limit` agendados, pela ordem de abertura. */
  async upcoming(limit: number): Promise<LotRow[]> {
    const result = await this.database.query<LotRow>(
      `SELECT ${LOT_COLUMNS} ${LOT_FROM} WHERE l.status = 'PUBLISHED' AND l.starts_at > clock_timestamp() ORDER BY l.starts_at ASC, l.id LIMIT $1`,
      [limit],
    );
    return result.rows;
  }

  async watches(userId: string): Promise<string[]> {
    const result = await this.database.query<{ lot_id: string }>(`SELECT lot_id FROM lot_watches WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    return result.rows.map((row) => row.lot_id);
  }

  /** Só lote publicado e ainda agendado aceita inscrição. Retorna o motivo quando recusa. */
  async addWatch(userId: string, lotId: string): Promise<"ok" | "missing" | "open"> {
    const result = await this.database.query(
      `INSERT INTO lot_watches (user_id, lot_id)
       SELECT $1, l.id FROM lots l WHERE l.id = $2 AND l.status = 'PUBLISHED' AND l.starts_at > clock_timestamp()
       ON CONFLICT (user_id, lot_id) DO NOTHING RETURNING lot_id`,
      [userId, lotId],
    );
    if ((result.rowCount ?? 0) > 0) return "ok";
    const lot = await this.database.query<{ scheduled: boolean }>(
      `SELECT (status = 'PUBLISHED' AND starts_at > clock_timestamp()) AS scheduled FROM lots WHERE id = $1 AND status <> 'CANCELLED'`,
      [lotId],
    );
    const row = lot.rows[0];
    if (!row) return "missing";
    return row.scheduled ? "ok" : "open";
  }

  async removeWatch(userId: string, lotId: string): Promise<void> {
    await this.database.query(`DELETE FROM lot_watches WHERE user_id = $1 AND lot_id = $2`, [userId, lotId]);
  }

  /**
   * Virada agendado→aberto: consome as inscrições dos lotes que já abriram e cria uma notificação por inscrito,
   * numa única instrução (idempotente pela chave única). Inscrições de lote cancelado são descartadas sem aviso.
   * Depois corta o histórico de cada usuário afetado nas 20 mais recentes.
   */
  async generateOpenedNotifications(): Promise<number> {
    const created = await this.database.query<{ user_id: string }>(
      `WITH due AS (
         DELETE FROM lot_watches w USING lots l
         WHERE l.id = w.lot_id AND (l.status = 'CANCELLED' OR (l.status = 'PUBLISHED' AND l.starts_at <= clock_timestamp()))
         RETURNING w.user_id, w.lot_id, l.status
       )
       INSERT INTO notifications (user_id, lot_id, kind)
       SELECT user_id, lot_id, 'LOT_OPENED' FROM due WHERE status = 'PUBLISHED'
       ON CONFLICT (user_id, lot_id, kind) DO NOTHING
       RETURNING user_id`,
    );
    const users = [...new Set(created.rows.map((row) => row.user_id))];
    if (users.length > 0) {
      await this.database.query(
        `DELETE FROM notifications n
         WHERE n.user_id = ANY($1::uuid[])
           AND n.id NOT IN (SELECT k.id FROM notifications k WHERE k.user_id = n.user_id ORDER BY k.created_at DESC, k.id DESC LIMIT $2)`,
        [users, NOTIFICATIONS_KEPT],
      );
    }
    return created.rowCount ?? 0;
  }

  async notifications(userId: string): Promise<NotificationRow[]> {
    const result = await this.database.query<NotificationRow>(
      `SELECT n.id, n.lot_id, n.kind, n.created_at, n.read_at, s.title, s.media_key, l.initial_cents::text AS initial_cents
       FROM notifications n JOIN lots l ON l.id = n.lot_id JOIN catalog_item_snapshots s ON s.id = l.snapshot_id
       WHERE n.user_id = $1 ORDER BY n.created_at DESC, n.id DESC LIMIT $2`,
      [userId, NOTIFICATIONS_KEPT],
    );
    return result.rows;
  }

  async markRead(userId: string, id: string | null): Promise<void> {
    if (id === null) {
      await this.database.query(`UPDATE notifications SET read_at = clock_timestamp() WHERE user_id = $1 AND read_at IS NULL`, [userId]);
      return;
    }
    await this.database.query(`UPDATE notifications SET read_at = clock_timestamp() WHERE user_id = $1 AND id = $2 AND read_at IS NULL`, [userId, id]);
  }

  async clock(): Promise<Date> {
    const result = await this.database.query<{ now: Date }>(`SELECT clock_timestamp() AS now`);
    const now = result.rows[0]?.now;
    if (!now) throw new Error("relógio do banco indisponível");
    return now;
  }
}
