import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { backdateLotHistory, spreadBidTimes } from "../../prisma/seed-timeline";
import type { Actor } from "../../src/auth/auth.service";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";

const HOUR = 3_600_000;

/** Pedido do Fernando (27/10): o histórico da demo não pode ter todos os lances no mesmo minuto. */
describe("linha do tempo da demo", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("seed-timeline-", connectionString);
  let seller: Actor;

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("espalha horários crescentes dentro da janela, estáveis por lote", () => {
    const start = Date.parse("2026-10-25T12:00:00.000Z");
    const last = start + 30 * HOUR;
    const times = spreadBidTimes("lote-a", start, last, 10);
    expect(times).toEqual(spreadBidTimes("lote-a", start, last, 10));
    expect(times.at(-1)).toBe(last);
    for (let i = 1; i < times.length; i += 1) expect((times[i] as number) - (times[i - 1] as number)).toBeGreaterThanOrEqual(20_000);
    expect(times[0]).toBeGreaterThan(start);
    expect(new Set(times.map((t) => new Date(t).toISOString().slice(0, 16))).size).toBe(10);
  });

  it("recua o lote e os lances mantendo a auditoria íntegra, e o leilão segue normal depois", async () => {
    const lotId = await fx.lot(seller);
    const [first, second, third] = [await fx.bidder(100_000n), await fx.bidder(100_000n), await fx.bidder(100_000n)];
    for (const [index, bidder] of [first, second, first].entries()) {
      await fx.service.placeBid(bidder as Actor, lotId, money(BigInt(10_000 + index * 500)), randomUUID());
    }
    const now = Date.now();
    await backdateLotHistory(fx.pool, { key: fx.key, store: fx.store }, lotId, new Date(now - 30 * HOUR), new Date(now - 5 * 60_000));

    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    const rows = await fx.pool.query<{ accepted_at: Date }>(`SELECT accepted_at FROM bids WHERE lot_id = $1 ORDER BY sequence`, [lotId]);
    const times = rows.rows.map((row) => row.accepted_at.getTime());
    expect(times[0]).toBeLessThan(now - 2 * HOUR);
    expect(times.at(-1)).toBe(now - 5 * 60_000);
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    // A cadeia continua a partir da cabeça reassinada: lance novo é aceito e a auditoria segue íntegra.
    expect(await outcome(fx.service.placeBid(third as Actor, lotId, money(11_500n), randomUUID()))).toBe("ACEITO");
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    await fx.assertInvariants([lotId]);
  });
});
