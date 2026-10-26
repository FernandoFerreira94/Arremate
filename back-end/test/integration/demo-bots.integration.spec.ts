import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/auth/auth.service";
import { DemoBotRunner } from "../../src/lots/demo-bot-runner";
import { LotEventsService } from "../../src/lots/lot-events.service";
import { WalletsRepository } from "../../src/wallets/wallets.repository";
import { WalletsService } from "../../src/wallets/wallets.service";
import { BiddingFixture, money } from "../support/bidding-fixture";

/** D31: o robô lança pelo mesmo BiddingService (reserva, notificações, auditoria) e deposita pelo WalletsService. */
describe("licitantes automáticos (D31)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("d31-robos-", connectionString);
  let seller: Actor;
  let bots: Array<Actor & { email: string }>;

  const runner = (lotIds: string[], random = () => 0) =>
    new DemoBotRunner(
      fx.database,
      fx.service,
      new WalletsService(fx.database, new WalletsRepository(fx.database)),
      new LotEventsService(),
      { intervalMs: 15000, maxBidsPerTick: 5, ceilingFactor: 3, maxBotBidsPerLot: 12, emails: bots.map((b) => b.email) },
      random,
      lotIds,
    );
  const kinds = async (userId: string, lotId: string) =>
    (await fx.pool.query<{ kind: string }>(`SELECT kind FROM notifications WHERE user_id = $1 AND lot_id = $2 AND read_at IS NULL ORDER BY kind`, [userId, lotId])).rows.map((r) => r.kind);

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
    bots = [await fx.bidder(0n), await fx.bidder(0n)];
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("cobre a pessoa com o mínimo exato, avisa quem foi superado e o leiloeiro, e a auditoria segue íntegra", async () => {
    const lotId = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    const person = await fx.bidder(100000n);
    await fx.service.placeBid(person, lotId, money(10000n), randomUUID());
    expect(await kinds(seller.userId, lotId)).toEqual(["NEW_BID"]);
    await fx.pool.query(`UPDATE notifications SET read_at = clock_timestamp() WHERE user_id = $1`, [seller.userId]);

    expect(await runner([lotId]).tick()).toBe(1);
    const top = await fx.pool.query<{ user_id: string; amount_cents: string }>(`SELECT user_id, amount_cents::text FROM bids WHERE lot_id = $1 ORDER BY amount_cents DESC LIMIT 1`, [lotId]);
    const botId = top.rows[0]?.user_id as string;
    expect(bots.map((b) => b.userId)).toContain(botId);
    expect(top.rows[0]?.amount_cents).toBe("10500");
    expect(await kinds(person.userId, lotId)).toEqual(["OUTBID"]);
    expect(await kinds(seller.userId, lotId)).toEqual(["NEW_BID"]);
    // O robô recebeu saldo por depósito simulado (entrada DEPOSIT no ledger), nunca escrita direta.
    expect((await fx.wallet(botId)).committed).toBe(10500n);

    // Com um robô liderando, a rodada seguinte não cobre outro robô.
    expect(await runner([lotId]).tick()).toBe(0);
    await fx.assertInvariants([lotId]);
  });

  it("para no teto e não lança em lote encerrado", async () => {
    const capped = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    const person = await fx.bidder(100000n);
    await fx.service.placeBid(person, capped, money(30000n), randomUUID());
    const ended = await fx.lot(seller, { startsInMs: -60_000, endsInMs: 2_000 });
    expect(await runner([capped, ended]).tick()).toBe(0);
    expect((await fx.lotRow(capped)).bids).toBe(1);
    expect((await fx.lotRow(ended)).bids).toBe(0);
    await fx.assertInvariants([capped, ended]);
  });
});
