import "reflect-metadata";
import type { Actor } from "../../src/auth/auth.service";
import { SettlementRunner } from "../../src/lots/settlement-runner";
import { BiddingFixture } from "../support/bidding-fixture";
import { Worker, ledger, sleep } from "../support/settlement-fixture";

jest.setTimeout(60_000);

describe("recuperação da liquidação", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa7-recuperacao-", connectionString);
  const workers: Worker[] = [];
  let seller: Actor;

  const worker = () => {
    const created = new Worker(fx);
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

  it("após o prazo, sem worker rodando, a varredura de startup liquida o lote", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 1200 });
    await fx.seedBid(lotId, await fx.bidder(50000n), 10000n);
    await sleep(1400);
    const runner = new SettlementRunner(worker().settlement, 60_000);
    await runner.onApplicationBootstrap();
    runner.onModuleDestroy();
    expect(await ledger(fx, lotId)).toEqual({ debits: 1, credits: 1, settlements: 1, receipts: 1 });
  });

  it("o runner a cada intervalo liquida lote que vence depois do startup", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 1200 });
    await fx.seedBid(lotId, await fx.bidder(50000n), 10000n);
    const runner = new SettlementRunner(worker().settlement, 200);
    await runner.onApplicationBootstrap();
    await sleep(2000);
    runner.onModuleDestroy();
    await runner.idle();
    expect((await fx.lotRow(lotId)).status).toBe("SETTLED");
  });

  it("restart depois do commit e antes da testemunha: fica indeterminado, não duplica e conclui no retry", async () => {
    const lotId = await fx.lot(seller, { endsInMs: 1200 });
    const bidder = await fx.bidder(50000n);
    await fx.seedBid(lotId, bidder, 10000n);
    await sleep(1400);
    const crashed = worker();
    crashed.store.failNextAdvance = "rename";
    await expect(crashed.settlement.settleLot(lotId)).rejects.toThrow();
    expect(await ledger(fx, lotId)).toEqual({ debits: 1, credits: 1, settlements: 1, receipts: 1 });
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INDETERMINATE");
    const restarted = worker();
    const summary = await restarted.settlement.settleDueLots();
    expect(summary.settled).toBe(0);
    await restarted.audit.retryCheckpoint(lotId);
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    await restarted.settlement.settleDueLots();
    expect(await ledger(fx, lotId)).toEqual({ debits: 1, credits: 1, settlements: 1, receipts: 1 });
    expect(await fx.wallet(bidder.userId)).toMatchObject({ total: 40000n, committed: 0n });
  });

  it("dois lotes compartilhando as mesmas carteiras liquidam em paralelo sem deadlock persistente", async () => {
    const a = await fx.bidder(100000n);
    const b = await fx.bidder(100000n);
    const first = await fx.lot(seller, { endsInMs: 1500 });
    const second = await fx.lot(seller, { endsInMs: 1500 });
    await fx.seedBid(first, b, 10000n);
    await fx.seedBid(first, a, 11000n);
    await fx.seedBid(second, a, 10000n);
    await fx.seedBid(second, b, 11000n);
    await sleep(1700);
    const [x, y] = [worker(), worker()];
    await Promise.all([x.settlement.settleLot(first), y.settlement.settleLot(second), x.settlement.settleLot(second).catch(() => null), y.settlement.settleLot(first).catch(() => null)]);
    for (const lotId of [first, second]) expect((await fx.lotRow(lotId)).status).toBe("SETTLED");
    expect(await fx.wallet(a.userId)).toMatchObject({ total: 89000n, committed: 0n });
    expect(await fx.wallet(b.userId)).toMatchObject({ total: 89000n, committed: 0n });
  });
});
