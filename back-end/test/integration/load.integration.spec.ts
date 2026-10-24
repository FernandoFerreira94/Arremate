import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/auth/auth.service";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";

/**
 * Ensaio proporcional (Tarefa 10): 20 licitantes simultaneos em um lote + uma carteira disputando
 * dois lotes ao mesmo tempo. Mede p95/erros e valida invariantes. Nao e promessa de escala.
 */
const BIDDERS = 20;
const ROUNDS = 5;
const BUSINESS = new Set(["ACEITO", "BID_BELOW_MINIMUM", "ALREADY_LEADING", "INSUFFICIENT_FUNDS"]);
jest.setTimeout(180_000);

const p95 = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
};

describe("ensaio de carga proporcional", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa10-carga-", connectionString);
  let seller: Actor;

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });
  afterAll(async () => {
    await fx.cleanup();
  });

  it(`${BIDDERS} licitantes x ${ROUNDS} rodadas num lote + carteira em dois lotes: sem erro tecnico, p95 medido, invariantes ok`, async () => {
    const lotA = await fx.lot(seller);
    const lotB = await fx.lot(seller);
    const lotC = await fx.lot(seller);
    const bidders = await Promise.all(Array.from({ length: BIDDERS }, () => fx.bidder(1_000_000n)));
    const split = await fx.bidder(15_000n);
    const latencies: number[] = [];
    const tally = new Map<string, number>();
    const timed = async (work: () => Promise<unknown>) => {
      const start = performance.now();
      const result = await outcome(work());
      latencies.push(performance.now() - start);
      tally.set(result, (tally.get(result) ?? 0) + 1);
      return result;
    };
    let wins = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      const amount = 10_000n + BigInt(round) * 500n;
      const results = await Promise.all([
        ...bidders.map((b) => timed(() => fx.service.placeBid(b, lotA, money(amount), randomUUID()))),
        ...(round === 0
          ? [timed(() => fx.service.placeBid(split, lotB, money(10_000n), randomUUID())), timed(() => fx.service.placeBid(split, lotC, money(10_000n), randomUUID()))]
          : []),
      ]);
      wins += results.slice(0, BIDDERS).filter((r) => r === "ACEITO").length;
    }
    for (const key of tally.keys()) expect(BUSINESS.has(key)).toBe(true);
    expect(wins).toBe(ROUNDS);
    expect((await fx.lotRow(lotA)).bids).toBe(ROUNDS);
    expect(await fx.wallet(split.userId)).toMatchObject({ total: 15_000n, committed: 10_000n });
    await fx.assertInvariants([lotA, lotB, lotC]);
    const measured = { requests: latencies.length, p95Ms: Math.round(p95(latencies)), maxMs: Math.round(Math.max(...latencies)), outcomes: Object.fromEntries(tally) };
    console.log(`CARGA ${JSON.stringify(measured)}`);
    expect(measured.p95Ms).toBeLessThan(2000);
  });
});