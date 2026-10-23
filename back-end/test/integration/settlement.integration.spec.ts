import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Actor } from "../../src/auth/auth.service";
import { SettlementRepository } from "../../src/lots/settlement.repository";
import { BiddingFixture, money } from "../support/bidding-fixture";
import { Worker, ledger, sleep } from "../support/settlement-fixture";

jest.setTimeout(60_000);

describe("liquidação", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa7-liquidacao-", connectionString);
  const workers: Worker[] = [];
  let seller: Actor;

  const worker = (repository?: SettlementRepository) => {
    const created = new Worker(fx, repository);
    workers.push(created);
    return created;
  };

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });

  afterAll(async () => {
    for (const created of workers) await created.close();
    await fx.cleanup();
  });

  it("settlesOnceAcrossWorkersAndRestart: dois workers e um novo processo geram um débito, um crédito e um recibo", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 1500 });
    const a = await fx.bidder(50000n);
    const b = await fx.bidder(50000n);
    await fx.seedBid(lotId, a, 10000n);
    await fx.seedBid(lotId, b, 12000n);
    await sleep(1700);
    const [first, second] = [worker(), worker()];
    await Promise.all([first.settlement.settleDueLots(), second.settlement.settleDueLots(), first.settlement.settleLot(lotId).catch(() => null)]);
    const restarted = worker();
    await restarted.settlement.settleDueLots();
    await restarted.settlement.settleLot(lotId);
    expect(await ledger(fx, lotId)).toEqual({ debits: 1, credits: 1, settlements: 1, receipts: 1 });
    expect(await fx.wallet(b.userId)).toMatchObject({ total: 38000n, committed: 0n });
    expect(await fx.wallet(a.userId)).toMatchObject({ total: 50000n, committed: 0n });
    expect(await fx.wallet(seller.userId)).toMatchObject({ total: 12000n, committed: 0n });
    expect((await fx.lotRow(lotId)).status).toBe("SETTLED");
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
  });

  it("dois arremates de 600000000000 para o mesmo vendedor somam 1200000000000 com dois recibos", async () => {
    const big = 600000000000n;
    const owner = await fx.user("AUCTIONEER");
    const lots = [await fx.lot(owner, { endsInMs: 1500, initialCents: big }), await fx.lot(owner, { endsInMs: 1500, initialCents: big })];
    for (const lotId of lots) await fx.seedBid(lotId, await fx.bidder(big), big);
    await sleep(1700);
    const w = worker();
    for (const lotId of lots) {
      const closed = await w.settlement.settleLot(lotId);
      expect(closed).toMatchObject({ status: "SETTLED", amountCents: money(big) });
      expect(closed.receiptToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    }
    expect(await fx.wallet(owner.userId)).toMatchObject({ total: 1200000000000n });
    for (const lotId of lots) {
      expect(await ledger(fx, lotId)).toEqual({ debits: 1, credits: 1, settlements: 1, receipts: 1 });
      expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    }
  });

  it("sem lance fecha sem vencedor, sem movimento e sem recibo", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 800 });
    await sleep(1000);
    const closed = await worker().settlement.settleLot(lotId);
    expect(closed).toMatchObject({ status: "CLOSED_NO_BIDS", amountCents: null, receiptToken: null });
    expect(await ledger(fx, lotId)).toEqual({ debits: 0, credits: 0, settlements: 1, receipts: 0 });
    expect((await fx.lotRow(lotId)).status).toBe("CLOSED_NO_BIDS");
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
  });

  it("lote prorrogado não fecha antes do novo fim", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 2500 });
    const bidder = await fx.bidder(50000n);
    const accepted = await fx.service.placeBid(bidder, lotId, "10000", randomUUID());
    expect(accepted.extended).toBe(true);
    await sleep(2700);
    const w = worker();
    const summary = await w.settlement.settleDueLots();
    expect(summary.settled).toBe(0);
    await expect(w.settlement.settleLot(lotId)).resolves.toMatchObject({ status: "OPEN" });
    expect(await ledger(fx, lotId)).toEqual({ debits: 0, credits: 0, settlements: 0, receipts: 0 });
    expect((await fx.lotRow(lotId)).status).toBe("PUBLISHED");
  });

  it("lote adulterado ou indeterminado não liquida", async () => {
    const tampered = await fx.lot(seller, { endsInMs: 1500 });
    const pending = await fx.lot(seller, { endsInMs: 1500 });
    const bidder = await fx.bidder(50000n);
    await fx.seedBid(tampered, bidder, 10000n);
    await fx.seedBid(pending, bidder, 10000n);
    await fx.pool.query(`UPDATE bids SET amount_cents = 1 WHERE lot_id = $1`, [tampered]);
    await fx.store.writePending({ ...(await fx.store.read(pending))!, revision: 99 });
    await sleep(1700);
    const w = worker();
    await expect(w.settlement.settleLot(tampered)).rejects.toThrow();
    await expect(w.settlement.settleLot(pending)).rejects.toThrow();
    const summary = await w.settlement.settleDueLots();
    expect(summary.blocked).toBeGreaterThanOrEqual(2);
    expect(await ledger(fx, tampered)).toEqual({ debits: 0, credits: 0, settlements: 0, receipts: 0 });
    expect(await ledger(fx, pending)).toEqual({ debits: 0, credits: 0, settlements: 0, receipts: 0 });
    await fx.store.clearPending(pending);
  });

  it("falha numa etapa intermediária desfaz tudo", async () => {
    class FailingReceipt extends SettlementRepository {
      override async insertReceipt(_client: PoolClient, _settlementId: string, _token: string): Promise<void> {
        throw new Error("falha simulada no recibo");
      }
    }
    const lotId = await fx.lot(seller, { endsInMs: 1500 });
    const bidder = await fx.bidder(50000n);
    await fx.seedBid(lotId, bidder, 10000n);
    await sleep(1700);
    const sellerBefore = await fx.wallet(seller.userId);
    await expect(worker(new FailingReceipt()).settlement.settleLot(lotId)).rejects.toThrow("falha simulada");
    expect(await ledger(fx, lotId)).toEqual({ debits: 0, credits: 0, settlements: 0, receipts: 0 });
    expect(await fx.wallet(bidder.userId)).toMatchObject({ total: 50000n, committed: 10000n });
    expect(await fx.wallet(seller.userId)).toMatchObject({ total: sellerBefore.total });
    expect((await fx.lotRow(lotId)).status).toBe("PUBLISHED");
    expect(await fx.store.readPending(lotId)).toBeNull();
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    await expect(worker().settlement.settleLot(lotId)).resolves.toMatchObject({ status: "SETTLED" });
  });
});
