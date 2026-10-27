import { createHash } from "node:crypto";
import { Logger } from "@nestjs/common";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import type { PoolClient } from "pg";
import { ConfirmationPendingError, IntegrityBlockedError, type AuditService } from "../audit/audit.service";
import { CatalogService } from "../catalog/catalog.service";
import { MoneyError, parsePositiveMoney } from "../common/money";
import { DatabaseRepository } from "../database/database.repository";
import type { CreateLotDto } from "./dto/create-lot.dto";
import { LotsRepository, type LotRow, type NotificationRow, type ShowcaseCounts, type ShowcaseState } from "./lots.repository";

export const SHOWCASE_PAGE_SIZE = 8;
export const START_TOLERANCE_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_OPERATION = "lot.create";

export type LotState = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
/** Resultado distinguível na UI: encerrado aguardando liquidação, liquidado ou sem lances. */
export type LotResult = "OPEN" | "CLOSED_PENDING" | "SETTLED" | "CLOSED_NO_BIDS" | "CANCELLED";

export type LotView = {
  id: string;
  externalId: string;
  title: string;
  artist: string;
  artistBio: string;
  date: string;
  medium: string;
  dimensions: string;
  credit: string;
  license: string;
  sourceUrl: string | null;
  imageUrl: string;
  initialCents: string;
  incrementCents: string;
  currentCents: string | null;
  minimumNextCents: string;
  bidCount: number;
  /** D17: faixa e laudo simulados para demonstração (`simulated: true` sempre). */
  estimate: { lowCents: string; highCents: string; simulated: true } | null;
  conditionReport: { text: string; simulated: true } | null;
  startsAt: string;
  endsAt: string;
  state: LotState;
  settlementPending: boolean;
  result: LotResult;
  serverNow: string;
};

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number; serverNow: string };

const UPCOMING_MAX = 5;
const ACTIVITY_LOOKBACK_MS = 5_000;
const TRANSIENT_REASONS = new Set(["CONFIRMATION_GAP", "CONCURRENT_READ"]);
const TRANSIENT_RETRIES = 3;
const TRANSIENT_WAIT_MS = 150;
const ACTIVITY_LIMIT = 50;

export type ActivityView = { id: string; lotId: string; title: string; alias: string; amountCents: string; acceptedAt: string };

export class LotsService {
  private readonly logger = new Logger(LotsService.name);

  constructor(
    private readonly database: DatabaseRepository,
    private readonly lots: LotsRepository,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService | null,
  ) {}

  async showcase(page: number, search?: string, state?: ShowcaseState): Promise<Paged<LotView> & { counts: ShowcaseCounts }> {
    const term = search?.trim().replace(/\s+/g, " ") || null;
    const { rows, total, counts } = await this.lots.showcase(SHOWCASE_PAGE_SIZE, (page - 1) * SHOWCASE_PAGE_SIZE, term, state ?? null);
    return { ...(await this.paged(rows, page, SHOWCASE_PAGE_SIZE, total)), counts };
  }

  async sellerLots(actor: Actor, page: number, limit: number): Promise<Paged<LotView>> {
    const { rows, total } = await this.lots.ownedBy(actor.userId, limit, (page - 1) * limit);
    return this.paged(rows, page, limit, total);
  }

  async detail(lotId: string): Promise<LotView> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const row = await this.lots.find(lotId);
    if (!row) throw new ApiException(404, "NAO_ENCONTRADO");
    return toView(row);
  }

  /** D22: lista privada de favoritos; `lotIds` alimenta o estado do coração sem tocar no cache público da vitrine. */
  async favorites(actor: Actor): Promise<{ items: LotView[]; lotIds: string[]; serverNow: string }> {
    const rows = await this.lots.favorites(actor.userId);
    const serverNow = rows[0]?.server_now ?? (await this.lots.clock());
    return { items: rows.map(toView), lotIds: rows.map((row) => row.id), serverNow: serverNow.toISOString() };
  }

  async setFavorite(actor: Actor, lotId: string, favorite: boolean): Promise<{ lotId: string; favorite: boolean }> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    if (favorite) {
      if (!(await this.lots.addFavorite(actor.userId, lotId))) throw new ApiException(404, "NAO_ENCONTRADO");
    } else {
      await this.lots.removeFavorite(actor.userId, lotId);
    }
    return { lotId, favorite };
  }

  /** D22 (H2): próximo leilão para o hero; `lot` nulo quando não há agendado. */
  async nextScheduled(): Promise<{ lot: LotView | null; serverNow: string }> {
    const row = await this.lots.nextScheduled();
    return { lot: row ? toView(row) : null, serverNow: (row?.server_now ?? (await this.lots.clock())).toISOString() };
  }

  /** D22 (H2b): carrossel do hero, até 5 agendados pela ordem de abertura. `limit` inválido cai no padrão 5. */
  async upcoming(limitRaw?: string): Promise<{ items: LotView[]; serverNow: string }> {
    const parsed = Number.parseInt(limitRaw ?? "", 10);
    const limit = Number.isFinite(parsed) ? Math.min(UPCOMING_MAX, Math.max(1, parsed)) : UPCOMING_MAX;
    const rows = await this.lots.upcoming(limit);
    return { items: rows.map(toView), serverNow: (rows[0]?.server_now ?? (await this.lots.clock())).toISOString() };
  }

  async watches(actor: Actor): Promise<{ lotIds: string[] }> {
    return { lotIds: await this.lots.watches(actor.userId) };
  }

  /** D22 (N1): "Avise-me quando abrir". Cancelar apaga a inscrição; lote já aberto recusa com 409. */
  async setWatch(actor: Actor, lotId: string, watch: boolean): Promise<{ lotId: string; watching: boolean }> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    if (!watch) {
      await this.lots.removeWatch(actor.userId, lotId);
      return { lotId, watching: false };
    }
    const outcome = await this.lots.addWatch(actor.userId, lotId);
    if (outcome === "missing") throw new ApiException(404, "NAO_ENCONTRADO");
    if (outcome === "open") throw new ApiException(409, "LOTE_JA_ABERTO");
    return { lotId, watching: true };
  }

  async notifications(actor: Actor): Promise<{ items: NotificationView[]; unread: number }> {
    const rows = await this.lots.notifications(actor.userId);
    const items = rows.map(toNotification);
    return { items, unread: items.filter((item) => item.readAt === null).length };
  }

  async markRead(actor: Actor, id: string | null): Promise<{ items: NotificationView[]; unread: number }> {
    if (id !== null && !UUID.test(id)) throw new ApiException(404, "NAO_ENCONTRADO");
    await this.lots.markRead(actor.userId, id);
    return this.notifications(actor);
  }

  /**
   * D32: feed de lances ao vivo de outras pessoas. Sem cursor devolve só o relógio do servidor (quem chega não
   * recebe o passado); com cursor, até 5 lances posteriores e o novo cursor.
   */
  async activity(actor: Actor, rawAfter: string | undefined): Promise<{ items: ActivityView[]; cursor: string }> {
    if (rawAfter === undefined) return { items: [], cursor: (await this.lots.clock()).toISOString() };
    const after = new Date(rawAfter);
    if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(rawAfter) || Number.isNaN(after.getTime())) throw new ApiException(400, "REQUISICAO_INVALIDA");
    // Auditoria item 11: `accepted_at` é o relógio do lance, não a ordem de commit; um lance pode aparecer
    // com horário anterior ao cursor. A consulta olha ACTIVITY_LOOKBACK_MS para trás e o feed descarta ids repetidos.
    const rows = await this.lots.activity(actor.userId, new Date(after.getTime() - ACTIVITY_LOOKBACK_MS), ACTIVITY_LIMIT);
    const items = rows.map((row) => ({ id: row.id, lotId: row.lot_id, title: row.title, alias: row.alias, amountCents: row.amount_cents, acceptedAt: row.accepted_at.toISOString() }));
    const last = items.at(-1)?.acceptedAt;
    return { items, cursor: last && Date.parse(last) > after.getTime() ? last : rawAfter };
  }

  generateOpenedNotifications(): Promise<number> {
    return this.lots.generateOpenedNotifications();
  }

  /** Verificação pública: status, revisão e contagem presos à mesma leitura. Sem chave é INDETERMINATE, nunca íntegro. */
  async publicAudit(lotId: string) {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const row = await this.lots.find(lotId);
    if (!row) {
      // Auditoria item 4: lote apagado com testemunha remanescente é adulteração (LOT_REMOVED), não 404.
      const removed = this.audit ? await this.audit.verifyLot(lotId.toLowerCase()) : null;
      if (removed?.status === "TAMPERED") return { lotId: lotId.toLowerCase(), ...removed };
      throw new ApiException(404, "NAO_ENCONTRADO");
    }
    if (!this.audit) {
      return { lotId: row.id, status: "INDETERMINATE" as const, revision: null, count: null, verifiedAt: new Date().toISOString(), reasonCode: "MISSING_KEY", message: "Verificação indisponível." };
    }
    return { lotId: row.id, ...(await this.settledVerification(row.id)) };
  }

  /**
   * Auditoria item 8: um lance em andamento deixa a testemunha com intenção pendente por milissegundos; a
   * página pública esperava esse instante e mostrava "Indeterminado". Agora espera a confirmação um pouco.
   */
  private async settledVerification(lotId: string) {
    let result = await this.audit!.verifyLot(lotId);
    for (let attempt = 0; attempt < TRANSIENT_RETRIES && result.status === "INDETERMINATE" && TRANSIENT_REASONS.has(result.reasonCode); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, TRANSIENT_WAIT_MS));
      result = await this.audit!.verifyLot(lotId);
    }
    return result;
  }

  async bids(lotId: string, page: number, limit: number) {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    if (!(await this.lots.find(lotId))) throw new ApiException(404, "NAO_ENCONTRADO");
    const { rows, total } = await this.lots.bids(lotId, limit, (page - 1) * limit);
    return {
      items: rows.map((row) => ({ alias: row.alias, amountCents: row.amount_cents, sequence: row.sequence, acceptedAt: row.accepted_at.toISOString() })),
      page,
      pageSize: limit,
      total,
    };
  }

  async createLot(actor: Actor, input: CreateLotDto, idempotencyKey: string | undefined): Promise<LotView> {
    if (typeof idempotencyKey !== "string" || !UUID.test(idempotencyKey)) throw new ApiException(400, "IDEMPOTENCIA_INVALIDA");
    const key = idempotencyKey.toLowerCase();
    const initial = money(input.initialCents);
    const increment = money(input.incrementCents);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= startsAt.getTime()) {
      throw new ApiException(400, "DATAS_INVALIDAS");
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify([input.externalId, initial.toString(), increment.toString(), startsAt.toISOString(), endsAt.toISOString()]))
      .digest("hex");
    const previous = await this.findRecord(actor.userId, key);
    if (previous) return this.replay(previous, requestHash);
    const now = await this.lots.clock();
    if (startsAt.getTime() < now.getTime() - START_TOLERANCE_MS || endsAt.getTime() <= now.getTime()) {
      throw new ApiException(400, "DATAS_INVALIDAS");
    }
    if (!this.audit) throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    const snapshot = await this.catalog.importItem(input.externalId);
    const created = await this.database.transaction(async (client) => {
      const lot = await client.query<{ id: string }>(
        `INSERT INTO lots (owner_id, snapshot_id, initial_cents, increment_cents, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [actor.userId, snapshot.id, initial.toString(), increment.toString(), startsAt.toISOString(), endsAt.toISOString()],
      );
      const lotId = lot.rows[0]?.id;
      if (!lotId) throw new Error("lote não criado");
      const record = await client.query(
        `INSERT INTO idempotency_records (user_id, operation, resource_key, idempotency_key, request_hash, response)
         VALUES ($1, $2, 'lots', $3, $4, $5::jsonb)
         ON CONFLICT (user_id, operation, resource_key, idempotency_key) DO NOTHING RETURNING id`,
        [actor.userId, CREATE_OPERATION, key, requestHash, JSON.stringify({ lotId })],
      );
      if (record.rowCount !== 1) return null;
      return lotId;
    });
    if (!created) {
      const winner = await this.findRecord(actor.userId, key);
      if (!winner) throw new ApiException(409, "IDEMPOTENCIA_CONFLITO");
      return this.replay(winner, requestHash);
    }
    try {
      await this.audit.openGenesis(created);
    } catch {
      this.logger.error("Gênese de auditoria falhou; publicação desfeita.");
      await this.database.transaction(async (client) => {
        await client.query(`DELETE FROM idempotency_records WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3`, [actor.userId, CREATE_OPERATION, key]);
        await client.query(`DELETE FROM lots WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM bids WHERE lot_id = $1)`, [created]);
      });
      throw new ApiException(503, "AUDITORIA_INDISPONIVEL");
    }
    return this.detail(created);
  }

  async cancelLot(actor: Actor, lotId: string): Promise<LotView> {
    if (!UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    type Cancellable = { owner_id: string; status: string; ended: boolean; revision: number; has_bids: boolean };
    const CANCELLABLE = `SELECT owner_id, status::text AS status, ends_at <= clock_timestamp() AS ended, revision,
                                EXISTS (SELECT 1 FROM bids WHERE lot_id = lots.id) AS has_bids FROM lots WHERE id = $1`;
    const refuse = (lot: Cancellable | undefined): void => {
      if (!lot || lot.owner_id !== actor.userId) throw new ApiException(404, "NAO_ENCONTRADO");
      if (lot.status !== "PUBLISHED" || lot.ended) throw new ApiException(409, "LOTE_NAO_CANCELAVEL");
      if (lot.has_bids) throw new ApiException(409, "LOTE_COM_LANCES");
    };
    // Recusas de regra saem antes da auditoria (não mudam nada); a checagem se repete sob lock na transação.
    refuse((await this.database.query<Cancellable>(CANCELLABLE, [lotId])).rows[0]);
    const cancel = async (client: PoolClient, expectedRevision: number | null) => {
      const lot = (await client.query<Cancellable>(`${CANCELLABLE} FOR UPDATE`, [lotId])).rows[0];
      refuse(lot);
      if (expectedRevision !== null && lot?.revision !== expectedRevision) throw new ConfirmationPendingError();
      // A revisão acompanha o envelope selado pela auditoria (cancelamento conta como uma mutação do lote).
      await client.query(`UPDATE lots SET status = 'CANCELLED', revision = revision + $2 WHERE id = $1`, [lotId, expectedRevision === null ? 0 : 1]);
    };
    try {
      if (this.audit) await this.audit.cancelAtomic(lotId, cancel);
      else await this.database.transaction((client) => cancel(client, null));
    } catch (error) {
      if (error instanceof ConfirmationPendingError) throw new ApiException(503, "CONFIRMATION_PENDING");
      if (error instanceof IntegrityBlockedError) {
        throw error.code === "CONFIRMATION_PENDING" ? new ApiException(503, "CONFIRMATION_PENDING") : new ApiException(409, "LOTE_BLOQUEADO");
      }
      throw error;
    }
    return this.detail(lotId);
  }

  private async findRecord(userId: string, key: string): Promise<{ request_hash: string; response: { lotId?: string } } | null> {
    const result = await this.database.query<{ request_hash: string; response: { lotId?: string } }>(
      `SELECT request_hash, response FROM idempotency_records
       WHERE user_id = $1 AND operation = $2 AND resource_key = 'lots' AND idempotency_key = $3`,
      [userId, CREATE_OPERATION, key],
    );
    return result.rows[0] ?? null;
  }

  private async replay(record: { request_hash: string; response: { lotId?: string } }, requestHash: string): Promise<LotView> {
    if (record.request_hash !== requestHash || typeof record.response.lotId !== "string") throw new ApiException(409, "IDEMPOTENCIA_CONFLITO");
    return this.detail(record.response.lotId);
  }

  private async paged(rows: LotRow[], page: number, pageSize: number, total: number): Promise<Paged<LotView>> {
    const serverNow = rows[0]?.server_now ?? (await this.lots.clock());
    return { items: rows.map(toView), page, pageSize, total, serverNow: serverNow.toISOString() };
  }
}

function money(value: string): bigint {
  try {
    return parsePositiveMoney(value);
  } catch (error) {
    if (error instanceof MoneyError) throw new ApiException(400, "VALOR_INVALIDO");
    throw error;
  }
}

export function lotState(status: string, startsAt: Date, endsAt: Date, now: Date): LotState {
  if (status === "CANCELLED") return "CANCELLED";
  if (status !== "PUBLISHED") return "ENDED";
  if (now.getTime() < startsAt.getTime()) return "SCHEDULED";
  if (now.getTime() < endsAt.getTime()) return "LIVE";
  return "ENDED";
}

export function lotResult(status: string, endsAt: Date, now: Date): LotResult {
  if (status === "CANCELLED" || status === "SETTLED" || status === "CLOSED_NO_BIDS") return status;
  return now.getTime() >= endsAt.getTime() ? "CLOSED_PENDING" : "OPEN";
}

export type NotificationView = {
  id: string;
  kind: string;
  lotId: string;
  title: string;
  imageUrl: string;
  initialCents: string;
  createdAt: string;
  readAt: string | null;
};

function toNotification(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    kind: row.kind,
    lotId: row.lot_id,
    title: row.title,
    imageUrl: `/api/media/${row.media_key}`,
    initialCents: row.initial_cents,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null,
  };
}

function toView(row: LotRow): LotView {
  const state = lotState(row.status, row.starts_at, row.ends_at, row.server_now);
  const attributes = row.attributes ?? {};
  const textOf = (name: string): string => (typeof attributes[name] === "string" ? (attributes[name] as string) : "");
  const current = row.current_cents;
  return {
    id: row.id,
    externalId: row.external_id,
    title: row.title,
    artist: textOf("artist"),
    artistBio: textOf("artistBio"),
    date: textOf("date"),
    medium: textOf("medium"),
    dimensions: textOf("dimensions"),
    credit: row.credit,
    license: row.license,
    sourceUrl: textOf("sourceUrl") || null,
    imageUrl: `/api/media/${row.media_key}`,
    initialCents: row.initial_cents,
    incrementCents: row.increment_cents,
    currentCents: current,
    minimumNextCents: current === null ? row.initial_cents : (BigInt(current) + BigInt(row.increment_cents)).toString(),
    bidCount: row.bid_count,
    estimate:
      row.estimate_low_cents !== null && row.estimate_high_cents !== null
        ? { lowCents: row.estimate_low_cents, highCents: row.estimate_high_cents, simulated: true }
        : null,
    conditionReport: row.condition_report ? { text: row.condition_report, simulated: true } : null,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    state,
    settlementPending: state === "ENDED" && (row.status === "PUBLISHED" || row.status === "CLOSED_PENDING"),
    result: lotResult(row.status, row.ends_at, row.server_now),
    serverNow: row.server_now.toISOString(),
  };
}
