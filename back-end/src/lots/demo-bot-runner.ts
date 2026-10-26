import { randomUUID } from "node:crypto";
import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import type { Actor } from "../auth/auth.service";
import { ApiException } from "../auth/api.exception";
import type { DatabaseRepository } from "../database/database.repository";
import type { WalletsService } from "../wallets/wallets.service";
import type { BiddingService } from "./bidding.service";
import type { LotEventsService } from "./lot-events.service";

/**
 * D31: licitantes automáticos da demonstração. Opt-in (DEMO_BOTS=1), nunca em NODE_ENV=test.
 * Cada lance passa pelo mesmo BiddingService da API (saldo reservado, incremento, prorrogação, trilha de auditoria)
 * e o depósito pelo mesmo WalletsService; o runner só LÊ o banco para escolher onde lançar.
 */
export type DemoBotConfig = {
  intervalMs: number;
  /** Lances no máximo por rodada, somando todos os lotes. */
  maxBidsPerTick: number;
  /** Robôs param de cobrir quando o próximo mínimo passa de inicial × fator (a pessoa consegue arrematar). */
  ceilingFactor: number;
  /** Lances de robô no máximo por lote. */
  maxBotBidsPerLot: number;
  emails: readonly string[];
};

export const DEMO_BOT_EMAILS = ["licitante2@arremate.demo", "licitante3@arremate.demo", "licitante4@arremate.demo"] as const;

/** Lê a configuração do ambiente; desligado sem DEMO_BOTS=1 e sempre desligado em NODE_ENV=test. */
export function demoBotConfig(env: NodeJS.ProcessEnv = process.env): DemoBotConfig | false {
  if (env.DEMO_BOTS !== "1" || env.NODE_ENV === "test") return false;
  const int = (raw: string | undefined, fallback: number, min: number, max: number) => {
    const value = Number(raw);
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  };
  const emails = (env.DEMO_BOT_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return {
    intervalMs: int(env.DEMO_BOT_INTERVAL_MS, 15000, 3000, 3_600_000),
    maxBidsPerTick: int(env.DEMO_BOT_MAX_BIDS, 2, 1, 20),
    ceilingFactor: int(env.DEMO_BOT_CEILING, 3, 1, 100),
    maxBotBidsPerLot: int(env.DEMO_BOT_MAX_PER_LOT, 12, 1, 1000),
    emails: emails.length > 0 ? emails : DEMO_BOT_EMAILS,
  };
}

export type BotLot = {
  id: string;
  initialCents: bigint;
  incrementCents: bigint;
  currentCents: bigint | null;
  leaderId: string | null;
  botBids: number;
};

export type BotBid = { lotId: string; botId: string; amountCents: bigint };

/**
 * Escolha pura (testável): primeiro os lotes em que uma pessoa lidera, depois, com chance menor, os lotes sem lance.
 * Nunca cobre outro robô (o leilão anda quando há gente), nunca passa do teto e varia o robô a cada lance.
 */
export function pickBotBids(lots: readonly BotLot[], bots: readonly string[], config: Pick<DemoBotConfig, "maxBidsPerTick" | "ceilingFactor" | "maxBotBidsPerLot">, random: () => number = Math.random): BotBid[] {
  if (bots.length === 0) return [];
  const isBot = new Set(bots);
  const eligible = lots.filter((lot) => {
    if (lot.botBids >= config.maxBotBidsPerLot) return false;
    if (lot.leaderId !== null && isBot.has(lot.leaderId)) return false;
    return next(lot) <= lot.initialCents * BigInt(config.ceilingFactor);
  });
  const humanLed = eligible.filter((lot) => lot.leaderId !== null);
  const empty = eligible.filter((lot) => lot.leaderId === null && random() < 0.25);
  const chosen = [...shuffle(humanLed, random), ...shuffle(empty, random)].slice(0, config.maxBidsPerTick);
  return chosen.map((lot) => ({ lotId: lot.id, botId: bots[Math.floor(random() * bots.length)] as string, amountCents: next(lot) }));
}

function next(lot: BotLot): bigint {
  return lot.currentCents === null ? lot.initialCents : lot.currentCents + lot.incrementCents;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

const DEPOSIT_CENTS = 5_000_000n; // R$ 50.000,00 simulados por recarga (limite do depósito: R$ 100.000,00)

export class DemoBotRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DemoBotRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly database: DatabaseRepository,
    private readonly bidding: BiddingService,
    private readonly wallets: WalletsService,
    private readonly events: LotEventsService,
    private readonly config: DemoBotConfig | false,
    private readonly random: () => number = Math.random,
    /** Só para testes de integração: restringe a rodada a estes lotes do banco compartilhado. */
    private readonly onlyLotIds: readonly string[] | null = null,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config === false) return;
    this.logger.log(`Licitantes automáticos ligados: a cada ${this.config.intervalMs} ms, até ${this.config.maxBidsPerTick} lance(s) por rodada.`);
    this.timer = setInterval(() => void this.tick(), this.config.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Uma rodada; devolve quantos lances foram aceitos. Recusa por regra (corrida com uma pessoa) só é ignorada. */
  async tick(): Promise<number> {
    if (this.config === false || this.busy) return 0;
    this.busy = true;
    try {
      const bots = await this.botIds(this.config.emails);
      const plan = pickBotBids(await this.liveLots(bots), bots, this.config, this.random);
      let accepted = 0;
      for (const bid of plan) {
        const actor: Actor = { userId: bid.botId, role: "BIDDER" };
        try {
          await this.ensureFunds(actor, bid.amountCents);
          await this.bidding.placeBid(actor, bid.lotId, bid.amountCents.toString(), randomUUID());
          this.events.publish(bid.lotId);
          accepted += 1;
        } catch (error) {
          if (!(error instanceof ApiException)) throw error;
        }
      }
      return accepted;
    } catch {
      this.logger.error("Rodada dos licitantes automáticos falhou; nova tentativa no próximo intervalo.");
      return 0;
    } finally {
      this.busy = false;
    }
  }

  private async botIds(emails: readonly string[]): Promise<string[]> {
    const result = await this.database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'BIDDER' AND lower(email) = ANY($1::text[]) ORDER BY email`, [[...emails]]);
    return result.rows.map((row) => row.id);
  }

  private async liveLots(bots: readonly string[]): Promise<BotLot[]> {
    const result = await this.database.query<{ id: string; initial_cents: string; increment_cents: string; current_cents: string | null; leader_id: string | null; bot_bids: number }>(
      `SELECT l.id, l.initial_cents::text AS initial_cents, l.increment_cents::text AS increment_cents,
              top.amount_cents::text AS current_cents, top.user_id AS leader_id,
              (SELECT count(*)::int FROM bids b WHERE b.lot_id = l.id AND b.user_id = ANY($1::uuid[])) AS bot_bids
       FROM lots l
       LEFT JOIN LATERAL (SELECT amount_cents, user_id FROM bids WHERE lot_id = l.id ORDER BY amount_cents DESC, sequence ASC LIMIT 1) top ON true
       WHERE l.status = 'PUBLISHED' AND l.starts_at <= clock_timestamp() AND l.ends_at > clock_timestamp() + interval '5 seconds'
         AND ($2::uuid[] IS NULL OR l.id = ANY($2::uuid[]))`,
      [[...bots], this.onlyLotIds === null ? null : [...this.onlyLotIds]],
    );
    return result.rows.map((row) => ({
      id: row.id,
      initialCents: BigInt(row.initial_cents),
      incrementCents: BigInt(row.increment_cents),
      currentCents: row.current_cents === null ? null : BigInt(row.current_cents),
      leaderId: row.leader_id,
      botBids: row.bot_bids,
    }));
  }

  private async ensureFunds(actor: Actor, amount: bigint): Promise<void> {
    const wallet = await this.wallets.getWallet(actor);
    if (BigInt(wallet.availableCents) >= amount) return;
    await this.wallets.deposit(actor, (amount > DEPOSIT_CENTS ? amount : DEPOSIT_CENTS).toString(), randomUUID());
  }
}
