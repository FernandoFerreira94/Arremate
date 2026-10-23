import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/auth/auth.service";
import { LotsRepository } from "../../src/lots/lots.repository";
import { LotsService } from "../../src/lots/lots.service";
import type { CatalogService } from "../../src/catalog/catalog.service";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";

const RACES = 20;
jest.setTimeout(120_000);

describe("lances sob concorrência", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa6-concorrencia-", connectionString);
  const lots: string[] = [];
  let seller: Actor;

  function bid(actor: Actor, lotId: string, amount: bigint, key: string = randomUUID()) {
    return fx.service.placeBid(actor, lotId, money(amount), key);
  }

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("ao superar, a reserva do antigo líder volta e a do novo reserva o valor inteiro na mesma transação", async () => {
    const lotId = await fx.lot(seller);
    lots.push(lotId);
    const a = await fx.bidder(50000n);
    const b = await fx.bidder(50000n);
    const first = await bid(a, lotId, 10000n);
    expect(first.bid).toMatchObject({ amountCents: "10000", sequence: 1 });
    expect(JSON.stringify(first)).not.toContain(a.userId);
    expect(await fx.wallet(a.userId)).toMatchObject({ committed: 10000n });
    await bid(b, lotId, 10500n);
    expect(await fx.wallet(a.userId)).toMatchObject({ total: 50000n, committed: 0n, reserved: 10000n, released: 10000n });
    expect(await fx.wallet(b.userId)).toMatchObject({ total: 50000n, committed: 10500n });
    expect(await outcome(bid(b, lotId, 20000n))).toBe("ALREADY_LEADING");
    await fx.assertInvariants([lotId]);
  });

  it(`dois lances simultâneos válidos no mesmo lote: só um vence (${RACES} repetições)`, async () => {
    for (let i = 0; i < RACES; i += 1) {
      const lotId = await fx.lot(seller);
      lots.push(lotId);
      const a = await fx.bidder(20000n);
      const b = await fx.bidder(20000n);
      const results = (await Promise.all([outcome(bid(a, lotId, 10000n)), outcome(bid(b, lotId, 10000n))])).sort();
      expect(results).toEqual(["ACEITO", "BID_BELOW_MINIMUM"]);
      expect((await fx.lotRow(lotId)).bids).toBe(1);
    }
    await fx.assertInvariants(lots);
  });

  it(`cannotOvercommitAcrossLots: carteira de 15000 em dois lotes de 10000 aceita só um (${RACES} repetições)`, async () => {
    for (let i = 0; i < RACES; i += 1) {
      const lotA = await fx.lot(seller);
      const lotB = await fx.lot(seller);
      lots.push(lotA, lotB);
      const bidder = await fx.bidder(15000n);
      const results = (await Promise.all([outcome(bid(bidder, lotA, 10000n)), outcome(bid(bidder, lotB, 10000n))])).sort();
      expect(results).toEqual(["ACEITO", "INSUFFICIENT_FUNDS"]);
      expect(await fx.wallet(bidder.userId)).toMatchObject({ total: 15000n, committed: 10000n });
    }
    await fx.assertInvariants(lots);
  });

  it("dois lotes que trocam licitantes ao mesmo tempo não travam (ordem de lock por carteira)", async () => {
    for (let i = 0; i < RACES; i += 1) {
      const lotA = await fx.lot(seller);
      const lotB = await fx.lot(seller);
      lots.push(lotA, lotB);
      const a = await fx.bidder(100000n);
      const b = await fx.bidder(100000n);
      await bid(a, lotA, 10000n);
      await bid(b, lotB, 10000n);
      const results = await Promise.all([outcome(bid(b, lotA, 10500n)), outcome(bid(a, lotB, 10500n))]);
      expect(results).toEqual(["ACEITO", "ACEITO"]);
    }
    await fx.assertInvariants(lots);
  });

  it(`cancelamento × primeiro lance: só um vence (${RACES} repetições)`, async () => {
    const lotsService = new LotsService(fx.database, new LotsRepository(fx.database), {} as CatalogService, fx.audit);
    for (let i = 0; i < RACES; i += 1) {
      const lotId = await fx.lot(seller);
      lots.push(lotId);
      const bidder = await fx.bidder(20000n);
      const [bidResult, cancelResult] = await Promise.all([outcome(bid(bidder, lotId, 10000n)), outcome(lotsService.cancelLot(seller, lotId))]);
      const row = await fx.lotRow(lotId);
      if (bidResult === "ACEITO") {
        expect(cancelResult).toBe("LOTE_COM_LANCES");
        expect(row).toMatchObject({ status: "PUBLISHED", bids: 1 });
      } else {
        expect([bidResult, cancelResult]).toEqual(["LOT_CANCELLED", "ACEITO"]);
        expect(row).toMatchObject({ status: "CANCELLED", bids: 0 });
        expect(await fx.wallet(bidder.userId)).toMatchObject({ committed: 0n });
      }
    }
    await fx.assertInvariants(lots);
  });
});
