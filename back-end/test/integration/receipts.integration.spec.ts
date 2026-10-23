import "reflect-metadata";
import { HttpException } from "@nestjs/common";
import type { Actor } from "../../src/auth/auth.service";
import { BiddingFixture } from "../support/bidding-fixture";
import { Worker, sleep } from "../support/settlement-fixture";

jest.setTimeout(60_000);

describe("comprovante, participações e painel", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa7-recibo-", connectionString);
  let w: Worker;
  let seller: Actor & { email: string };
  let winner: Actor & { email: string };
  let loser: Actor & { email: string };
  let lotId: string;
  let token: string;
  let winningBid: string;
  let losingBid: string;

  beforeAll(async () => {
    await fx.init();
    w = new Worker(fx);
    seller = await fx.user("AUCTIONEER");
    winner = await fx.bidder(50000n);
    loser = await fx.bidder(50000n);
    lotId = await fx.lot(seller, { endsInMs: 1500 });
    losingBid = await fx.seedBid(lotId, loser, 10000n);
    winningBid = await fx.seedBid(lotId, winner, 10500n);
    await sleep(1700);
    const closed = await w.settlement.settleLot(lotId);
    token = closed.receiptToken as string;
  });

  afterAll(async () => {
    await w.close();
    await fx.cleanup();
  });

  it("comprovante público traz só dados seguros e confere com a auditoria", async () => {
    const receipt = await w.receipts.getReceipt(token);
    expect(receipt).toMatchObject({ lotId, winnerAlias: "Licitante 2", amountCents: "10500", simulated: true, valid: true, audit: { status: "INTACT" } });
    expect(receipt.code).toMatch(/^ARR-[0-9A-F]{10}$/);
    const text = JSON.stringify(receipt);
    for (const secret of [seller.userId, seller.email, winner.userId, winner.email, loser.userId, winningBid, losingBid, token]) expect(text).not.toContain(secret);
  });

  it("token tem 192 bits aleatórios, não sequencial; token inválido ou inexistente responde 404", async () => {
    expect(Buffer.from(token, "base64url")).toHaveLength(24);
    for (const bad of ["x", "../etc", "A".repeat(32)]) {
      await expect(w.receipts.getReceipt(bad)).rejects.toBeInstanceOf(HttpException);
    }
  });

  it("SQL direto no vencedor, no dono ou no recibo faz o documento não aparecer como válido", async () => {
    const forged = "forjado_forjado_forjado_forjado0";
    const cases: Array<[string, string, unknown[], string, string]> = [
      [`UPDATE settlements SET winner_bid_id = $2 WHERE lot_id = $1`, `UPDATE settlements SET winner_bid_id = $2 WHERE lot_id = $1`, [lotId, losingBid], winningBid, token],
      [`UPDATE lots SET owner_id = $2 WHERE id = $1`, `UPDATE lots SET owner_id = $2 WHERE id = $1`, [lotId, winner.userId], seller.userId, token],
      [`UPDATE receipts SET public_token = $2 WHERE public_token = $1`, `UPDATE receipts SET public_token = $1 WHERE public_token = $2`, [token, forged], "", forged],
    ];
    for (const [tamper, restore, params, original, lookup] of cases) {
      await fx.pool.query(tamper, params);
      try {
        expect(await w.receipts.getReceipt(lookup)).toMatchObject({ valid: false });
      } finally {
        await fx.pool.query(restore, original ? [params[0], original] : params);
      }
    }
    expect(await w.receipts.getReceipt(token)).toMatchObject({ valid: true });
  });

  it("participações incluem a perdida; arremates só depois de liquidado; painel soma créditos liquidados", async () => {
    const lost = await w.settlement.listParticipations(loser, 1);
    expect(lost.items).toEqual([expect.objectContaining({ lotId, outcome: "LOST", myTopCents: "10000", receiptToken: null })]);
    const won = await w.settlement.listParticipations(winner, 1);
    expect(won.items).toEqual([expect.objectContaining({ lotId, outcome: "WON", receiptToken: token })]);
    expect((await w.settlement.listAwards(winner, 1)).items).toEqual([expect.objectContaining({ lotId, amountCents: "10500", receiptToken: token })]);
    expect((await w.settlement.listAwards(loser, 1)).items).toEqual([]);
    const open = await fx.lot(seller);
    await fx.seedBid(open, winner, 20000n);
    expect((await w.settlement.listParticipations(winner, 1)).items).toEqual(expect.arrayContaining([expect.objectContaining({ lotId: open, outcome: "LEADING" })]));
    expect((await w.settlement.listAwards(winner, 1)).items).toHaveLength(1);
    const summary = await w.settlement.getSellerSummary(seller);
    expect(summary).toMatchObject({ settledCreditCents: "10500", settled: 1, open: 1 });
    expect(JSON.stringify(lost)).not.toContain(winner.userId);
  });
});
