/**
 * Catalogo de demonstracao (D17, Fernando 24/10/2026): 24 obras do The Met (CC0), proposta do Fred;
 * rodada 3 (D19) soma 6 agendados e 6 encerrados (36 obras, nenhuma repetida)
 * em docs/design/PROPOSTA-CONTEUDO.md.
 * - Obra e imagem pelo CatalogService.importItem (cliente + importador do Met que ja existem).
 * - Lote, lance, deposito e liquidacao SO pelos servicos normais (HMAC, carteira, recibo, auditoria).
 * - Estimativa e laudo sao SIMULADOS para demonstracao (nunca vem do Met).
 * - Idempotente: reexecutar nao apaga nada, nao repete deposito e nao recria lote que ja existe.
 *   Com `prepare` (comando --preparar-lote), recria so os lotes ao vivo/agendados que ja venceram.
 * - "Encerrando" e derivado do tempo restante; nao existe status novo.
 */
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { Actor } from "../src/auth/auth.service";
import type { CatalogService } from "../src/catalog/catalog.service";
import type { BiddingService } from "../src/lots/bidding.service";
import type { LotsService } from "../src/lots/lots.service";
import type { SettlementService } from "../src/lots/settlement.service";
import type { WalletsService } from "../src/wallets/wallets.service";
import { backdateLotHistory, type TimelineSigner } from "./seed-timeline";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** Lote "encerrado" do seed: aberto agora, fecha logo depois dos lances (acima dos 120 s do anti-sniping). */
export const CLOSE_LEAD_MS = 135_000;

export type SeedState = "OPEN" | "ENDING" | "CLOSED" | "SCHEDULED";

export type CatalogEntry = {
  lot: string;
  externalId: string;
  initial: number; // reais
  estimate: [number, number]; // reais, SIMULADO
  state: SeedState;
  /** OPEN/ENDING: fim relativo ao seed; SCHEDULED: inicio relativo. */
  offsetMs?: number;
  bids?: { n: number; final: number; winner: number; with: number[] };
  condition: string; // SIMULADO
};

const PAINT = "Pintura estável, verniz levemente amarelado e craquelê fino compatível com a idade. Pequenos retoques antigos visíveis sob luz UV.";
const PANEL = "Painel estável, sem empenamento ativo. Craquelê fino uniforme e retoques antigos localizados nas bordas.";
const PRINT = "Papel com leve amarelecimento e cores ainda vivas. Pequena dobra no canto inferior, sem perda de imagem.";
const WOOD = "Madeira com fissuras de secagem estabilizadas e perdas de policromia. Traços de cor original preservados.";
const LACQUER = "Laca com microrriscos de uso e incrustações íntegras. Cordão e netsuke não acompanham o lote.";

/** Tabela da proposta do Fred (secao 2). Lances finais e estimativas sao simulados. */
export const DEMO_CATALOG: readonly CatalogEntry[] = [
  { lot: "0001", externalId: "459080", initial: 3000, estimate: [6000, 9000], state: "OPEN", offsetMs: 2 * DAY, bids: { n: 8, final: 5400, winner: 1, with: [1, 2, 3] }, condition: PANEL },
  { lot: "0002", externalId: "435809", initial: 20000, estimate: [40000, 60000], state: "ENDING", offsetMs: 25 * MIN, bids: { n: 12, final: 38000, winner: 2, with: [1, 2, 4] }, condition: PANEL },
  { lot: "0003", externalId: "436575", initial: 15000, estimate: [30000, 45000], state: "OPEN", offsetMs: 3 * DAY, bids: { n: 6, final: 21000, winner: 3, with: [3, 2] }, condition: PAINT },
  { lot: "0004", externalId: "53162", initial: 9000, estimate: [18000, 25000], state: "CLOSED", bids: { n: 9, final: 19500, winner: 2, with: [2, 3, 4] }, condition: WOOD },
  { lot: "0005", externalId: "436545", initial: 12000, estimate: [25000, 35000], state: "OPEN", offsetMs: 4 * DAY, bids: { n: 5, final: 16000, winner: 4, with: [4, 1] }, condition: PAINT },
  { lot: "0006", externalId: "45585", initial: 300, estimate: [800, 1200], state: "OPEN", offsetMs: 1 * DAY + 6 * HOUR, bids: { n: 10, final: 780, winner: 1, with: [1, 2, 3, 4] }, condition: LACQUER },
  { lot: "0007", externalId: "436105", initial: 5000, estimate: [10000, 14000], state: "CLOSED", bids: { n: 12, final: 12900, winner: 1, with: [1, 2] }, condition: PAINT },
  { lot: "0008", externalId: "45434", initial: 1000, estimate: [2000, 3500], state: "ENDING", offsetMs: 12 * MIN, bids: { n: 14, final: 2600, winner: 2, with: [1, 2, 3] }, condition: PRINT },
  { lot: "0009", externalId: "438815", initial: 100, estimate: [35000, 50000], state: "OPEN", offsetMs: 5 * DAY, bids: { n: 7, final: 4200, winner: 1, with: [1, 3] }, condition: PAINT },
  { lot: "0010", externalId: "437853", initial: 10000, estimate: [20000, 30000], state: "SCHEDULED", offsetMs: 3 * HOUR, condition: PAINT },
  { lot: "0011", externalId: "11417", initial: 30000, estimate: [60000, 90000], state: "OPEN", offsetMs: 6 * DAY, bids: { n: 4, final: 42000, winner: 3, with: [3, 4] }, condition: PAINT },
  { lot: "0012", externalId: "437984", initial: 8000, estimate: [15000, 20000], state: "CLOSED", bids: { n: 10, final: 14600, winner: 3, with: [1, 3] }, condition: PAINT },
  { lot: "0013", externalId: "10481", initial: 25000, estimate: [50000, 80000], state: "OPEN", offsetMs: 6 * DAY + 12 * HOUR, bids: { n: 3, final: 31000, winner: 4, with: [4, 2] }, condition: PAINT },
  { lot: "0014", externalId: "10154", initial: 22000, estimate: [45000, 70000], state: "SCHEDULED", offsetMs: 2 * DAY, condition: PAINT },
  { lot: "0015", externalId: "436002", initial: 11000, estimate: [22000, 32000], state: "CLOSED", condition: PAINT },
  { lot: "0016", externalId: "437329", initial: 2000, estimate: [5000, 8000], state: "OPEN", offsetMs: 7 * DAY, bids: { n: 6, final: 3400, winner: 2, with: [2, 1] }, condition: PAINT },
  { lot: "0017", externalId: "436121", initial: 7000, estimate: [14000, 20000], state: "OPEN", offsetMs: 3 * DAY + 8 * HOUR, bids: { n: 5, final: 9800, winner: 1, with: [1, 4] }, condition: PAINT },
  { lot: "0018", externalId: "438817", initial: 14000, estimate: [28000, 40000], state: "ENDING", offsetMs: 40 * MIN, bids: { n: 9, final: 26500, winner: 4, with: [1, 3, 4] }, condition: PAINT },
  { lot: "0019", externalId: "436947", initial: 9000, estimate: [18000, 26000], state: "CLOSED", bids: { n: 11, final: 21800, winner: 1, with: [1, 2, 4] }, condition: PAINT },
  { lot: "0020", externalId: "12127", initial: 15000, estimate: [30000, 45000], state: "OPEN", offsetMs: 4 * DAY + 4 * HOUR, bids: { n: 8, final: 24500, winner: 2, with: [2, 3] }, condition: PAINT },
  { lot: "0021", externalId: "437654", initial: 12000, estimate: [24000, 34000], state: "OPEN", offsetMs: 5 * DAY + 2 * HOUR, condition: PAINT },
  { lot: "0022", externalId: "436535", initial: 18000, estimate: [35000, 55000], state: "ENDING", offsetMs: 50 * MIN, bids: { n: 10, final: 41000, winner: 3, with: [2, 3] }, condition: PAINT },
  { lot: "0023", externalId: "435882", initial: 8000, estimate: [16000, 24000], state: "CLOSED", bids: { n: 8, final: 18200, winner: 2, with: [1, 2] }, condition: PAINT },
  { lot: "0024", externalId: "11122", initial: 10000, estimate: [20000, 30000], state: "ENDING", offsetMs: 55 * MIN, bids: { n: 2, final: 10500, winner: 4, with: [4, 1] }, condition: PAINT },
  // Rodada 3 (D19, Fernando 24/10/2026): mais agendados e encerrados, obras CC0 do Met verificadas na API, sem repetir.
  { lot: "0025", externalId: "436532", initial: 20000, estimate: [40000, 60000], state: "SCHEDULED", offsetMs: 1 * DAY, condition: PAINT },
  { lot: "0026", externalId: "436528", initial: 25000, estimate: [50000, 80000], state: "SCHEDULED", offsetMs: 1 * DAY + 3 * HOUR, condition: PAINT },
  { lot: "0027", externalId: "436965", initial: 12000, estimate: [24000, 36000], state: "SCHEDULED", offsetMs: 2 * DAY + 6 * HOUR, condition: PAINT },
  { lot: "0028", externalId: "437397", initial: 18000, estimate: [36000, 50000], state: "SCHEDULED", offsetMs: 3 * DAY, condition: PANEL },
  { lot: "0029", externalId: "436838", initial: 15000, estimate: [30000, 45000], state: "SCHEDULED", offsetMs: 4 * DAY, condition: PAINT },
  { lot: "0030", externalId: "435868", initial: 22000, estimate: [45000, 65000], state: "SCHEDULED", offsetMs: 5 * DAY, condition: PAINT },
  { lot: "0031", externalId: "436944", initial: 6000, estimate: [12000, 18000], state: "CLOSED", bids: { n: 7, final: 9400, winner: 3, with: [3, 4] }, condition: PAINT },
  { lot: "0032", externalId: "459123", initial: 7000, estimate: [14000, 20000], state: "CLOSED", bids: { n: 6, final: 10200, winner: 4, with: [4, 2] }, condition: PAINT },
  { lot: "0033", externalId: "436896", initial: 4000, estimate: [9000, 14000], state: "CLOSED", bids: { n: 5, final: 6100, winner: 2, with: [2, 3] }, condition: PANEL },
  { lot: "0034", externalId: "437790", initial: 3000, estimate: [7000, 10000], state: "CLOSED", bids: { n: 8, final: 5600, winner: 3, with: [1, 3, 4] }, condition: PAINT },
  { lot: "0035", externalId: "436155", initial: 5000, estimate: [10000, 15000], state: "CLOSED", bids: { n: 6, final: 7800, winner: 4, with: [4, 1] }, condition: PAINT },
  { lot: "0036", externalId: "438012", initial: 4000, estimate: [8000, 12000], state: "CLOSED", condition: PAINT },
];

/** Depositos simulados por licitante (D05: R$ 1 a R$ 100 mil por deposito). */
export const DEMO_DEPOSITS_REAIS = [100_000, 50_000, 10_000, 5_000, 1_000] as const;

export type CatalogSeedOptions = {
  pool: Pool;
  catalog: CatalogService;
  lots: LotsService;
  bidding: BiddingService;
  wallets: WalletsService;
  settlement: SettlementService;
  ownerId: string;
  bidderIds: readonly string[]; // licitante1..4
  prepare?: boolean;
  closeLeadMs?: number;
  log?: (line: string) => void;
  /** Com a chave e a testemunha, o histórico de lances ganha horários espalhados e realistas. */
  timeline?: TimelineSigner;
};

export type CatalogSeedResult = { created: Array<{ lot: string; lotId: string }>; skipped: string[]; warnings: string[] };

const cents = (reais: number): bigint => BigInt(Math.round(reais * 100));

export function stableUuid(...parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function incrementFor(initialReais: number): number {
  if (initialReais < 1000) return 10;
  if (initialReais < 10000) return 50;
  return Math.max(100, Math.round((initialReais * 0.02) / 100) * 100);
}

/** Valores crescentes do lance inicial ao final, respeitando o incremento minimo. */
export function bidAmounts(initialReais: number, finalReais: number, n: number): number[] {
  const inc = incrementFor(initialReais);
  const step = inc;
  if (n === 1) return [initialReais];
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const raw = initialReais + ((finalReais - initialReais) * i) / (n - 1);
    let v = i === 0 ? initialReais : i === n - 1 ? finalReais : initialReais + Math.round((raw - initialReais) / step) * step;
    if (i > 0) v = Math.max(v, (out[i - 1] as number) + inc);
    out.push(v);
  }
  if (out[n - 1] !== finalReais) throw new Error(`plano de lances invalido (${initialReais}->${finalReais}, ${n})`);
  return out;
}

/** Ordem de licitantes alternada, terminando no vencedor, sem o mesmo licitante duas vezes seguidas. */
export function bidderOrder(n: number, winner: number, participants: readonly number[]): number[] {
  const p = participants.length;
  const w = participants.indexOf(winner);
  if (w < 0 || p < 2) throw new Error("vencedor fora dos participantes");
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(participants[(((w - (n - 1 - i)) % p) + p) % p] as number);
  return out;
}

export async function runCatalogSeed(o: CatalogSeedOptions): Promise<CatalogSeedResult> {
  const log = o.log ?? (() => undefined);
  const result: CatalogSeedResult = { created: [], skipped: [], warnings: [] };
  const bidder = (n: number): Actor => ({ userId: o.bidderIds[n - 1] as string, role: "BIDDER" });
  const owner: Actor = { userId: o.ownerId, role: "AUCTIONEER" };

  // Depositos pelo servico de carteira com chave fixa: reexecutar devolve o mesmo resultado, sem somar de novo.
  for (let b = 1; b <= o.bidderIds.length; b += 1) {
    for (const [i, reais] of DEMO_DEPOSITS_REAIS.entries()) {
      await o.wallets.deposit(bidder(b), cents(reais).toString(), stableUuid("seed-deposit", o.bidderIds[b - 1] as string, String(i)));
    }
  }

  const closing: Array<{ entry: CatalogEntry; lotId: string }> = [];
  for (const entry of DEMO_CATALOG) {
    const existing = await o.pool.query<{ id: string; active: boolean }>(
      `SELECT l.id, (l.status = 'PUBLISHED' AND l.ends_at > clock_timestamp()) AS active
       FROM lots l JOIN catalog_item_snapshots s ON s.id = l.snapshot_id
       WHERE l.owner_id = $1 AND s.provider = 'met' AND s.external_id = $2 ORDER BY l.created_at DESC`,
      [o.ownerId, entry.externalId],
    );
    for (const row of existing.rows) await backfillSimulated(o.pool, row.id, entry);
    const keep = existing.rows.length > 0 && (!o.prepare || entry.state === "CLOSED" || existing.rows.some((r) => r.active));
    if (keep) {
      result.skipped.push(entry.lot);
      continue;
    }
    let lotId: string;
    try {
      const now = Date.now();
      const startsAt = entry.state === "SCHEDULED" ? now + (entry.offsetMs ?? DAY) : now;
      const endsAt =
        entry.state === "CLOSED" ? now + (o.closeLeadMs ?? CLOSE_LEAD_MS) : entry.state === "SCHEDULED" ? startsAt + 5 * DAY : now + (entry.offsetMs ?? DAY);
      const view = await o.lots.createLot(
        owner,
        {
          externalId: entry.externalId,
          initialCents: cents(entry.initial).toString(),
          incrementCents: cents(incrementFor(entry.initial)).toString(),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        },
        stableUuid("seed-lot", o.ownerId, entry.externalId, String(startsAt)),
      );
      lotId = view.id;
    } catch (error) {
      result.warnings.push(`Lote ${entry.lot} (Met ${entry.externalId}) nao criado: ${error instanceof Error ? error.message : "erro"}.`);
      continue;
    }
    await backfillSimulated(o.pool, lotId, entry);
    if (entry.bids && entry.bids.n > 0) {
      const amounts = bidAmounts(entry.initial, entry.bids.final, entry.bids.n);
      const order = bidderOrder(entry.bids.n, entry.bids.winner, entry.bids.with);
      for (let i = 0; i < amounts.length; i += 1) {
        await o.bidding.placeBid(bidder(order[i] as number), lotId, cents(amounts[i] as number).toString(), stableUuid("seed-bid", lotId, String(i)));
      }
      if (o.timeline) {
        const { startsAt, lastBidAt } = demoTimeline(entry, lotId, Date.now());
        await backdateLotHistory(o.pool, o.timeline, lotId, startsAt, lastBidAt);
      }
    }
    result.created.push({ lot: entry.lot, lotId });
    log(`Lote ${entry.lot} criado (${entry.state}).`);
    if (entry.state === "CLOSED") closing.push({ entry, lotId });
  }

  if (closing.length > 0) {
    const ends = await o.pool.query<{ wait_ms: number }>(
      `SELECT GREATEST(0, EXTRACT(EPOCH FROM (max(ends_at) - clock_timestamp())) * 1000)::int AS wait_ms FROM lots WHERE id = ANY($1::uuid[])`,
      [closing.map((c) => c.lotId)],
    );
    const waitMs = (ends.rows[0]?.wait_ms ?? 0) + 1500;
    log(`Aguardando ${Math.ceil(waitMs / 1000)} s para liquidar ${closing.length} lote(s) encerrado(s) pelo fluxo normal...`);
    await new Promise((r) => setTimeout(r, waitMs));
    for (const c of closing) {
      const closed = await o.settlement.settleLot(c.lotId);
      if (closed.status === "OPEN") result.warnings.push(`Lote ${c.entry.lot} ainda aberto na liquidacao; a varredura da API fecha depois.`);
    }
  }
  return result;
}

/** Inicio recuado e ultimo lance para a demo: encerrados e "encerrando" comecaram ha ~2 dias; ao vivo, entre 6 h e 40 h. */
export function demoTimeline(entry: CatalogEntry, lotId: string, now: number): { startsAt: Date; lastBidAt: Date } {
  const spread = createHash("sha256").update(lotId).digest().readUInt32BE(0) / 0xffffffff;
  if (entry.state === "OPEN") return { startsAt: new Date(now - (6 + spread * 34) * HOUR), lastBidAt: new Date(now - (5 + spread * 85) * MIN) };
  return { startsAt: new Date(now - (2 * DAY + spread * 10 * HOUR)), lastBidAt: new Date(now - (2 + spread * 6) * MIN) };
}

/** Estimativa e laudo sao dados SIMULADOS do lote (D17); so preenche se estiver vazio. */
async function backfillSimulated(pool: Pool, lotId: string, entry: CatalogEntry): Promise<void> {
  await pool.query(
    `UPDATE lots SET estimate_low_cents = $2, estimate_high_cents = $3 WHERE id = $1 AND estimate_low_cents IS NULL AND estimate_high_cents IS NULL`,
    [lotId, cents(entry.estimate[0]).toString(), cents(entry.estimate[1]).toString()],
  );
  await pool.query(`UPDATE lots SET condition_report = $2 WHERE id = $1 AND condition_report IS NULL`, [lotId, entry.condition]);
}
