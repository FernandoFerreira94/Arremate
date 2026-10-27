import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { Actor } from "../../src/auth/auth.service";
import { ANTI_SNIPING_MS } from "../../src/lots/bid-rules";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";

jest.setTimeout(30_000);

describe("fronteiras de tempo do lance", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa6-tempo-", connectionString);
  let seller: Actor;

  function bid(actor: Actor, lotId: string, amount: bigint) {
    return fx.service.placeBid(actor, lotId, money(amount), randomUUID());
  }

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("recusa antes do início, depois do fim e em lote cancelado, sem reservar", async () => {
    const bidder = await fx.bidder(50000n);
    const future = await fx.lot(seller, { startsInMs: 60_000 });
    const ended = await fx.lot(seller, { startsInMs: -7_200_000, endsInMs: -3_600_000 });
    const cancelled = await fx.lot(seller);
    // Cancelamento pelo caminho selado; UPDATE direto agora é adulteração (auditoria item 2).
    await fx.audit.cancelAtomic(cancelled, async (client, revision) => {
      await client.query(`UPDATE lots SET status = 'CANCELLED', revision = $2 WHERE id = $1`, [cancelled, revision + 1]);
    });
    expect(await outcome(bid(bidder, future, 10000n))).toBe("LOT_NOT_STARTED");
    expect(await outcome(bid(bidder, ended, 10000n))).toBe("LOT_ENDED");
    expect(await outcome(bid(bidder, cancelled, 10000n))).toBe("LOT_CANCELLED");
    expect(await fx.wallet(bidder.userId)).toMatchObject({ committed: 0n });
  });

  it("lance com menos de 120s restantes prorroga para aceite + 120s; com folga mantém o fim", async () => {
    const bidder = await fx.bidder(50000n);
    const closing = await fx.lot(seller, { endsInMs: 30_000 });
    const accepted = await bid(bidder, closing, 10000n);
    const row = await fx.lotRow(closing);
    expect(new Date(accepted.endsAt).getTime()).toBe(new Date(accepted.bid.acceptedAt).getTime() + ANTI_SNIPING_MS);
    expect(row.endsAt.toISOString()).toBe(accepted.endsAt);
    expect(accepted.extended).toBe(true);

    const relaxed = await fx.lot(seller, { endsInMs: 3_600_000 });
    const before = await fx.lotRow(relaxed);
    const normal = await bid(bidder, relaxed, 10000n);
    expect(normal.extended).toBe(false);
    expect((await fx.lotRow(relaxed)).endsAt.getTime()).toBe(before.endsAt.getTime());
  });

  it("rejeição perto do fim nunca prorroga", async () => {
    const bidder = await fx.bidder(50000n);
    const closing = await fx.lot(seller, { endsInMs: 30_000 });
    const before = await fx.lotRow(closing);
    expect(await outcome(bid(bidder, closing, 9999n))).toBe("BID_BELOW_MINIMUM");
    const after = await fx.lotRow(closing);
    expect(after).toEqual(before);
  });

  it("rejectsAfterWaitingPastDeadline: lock real do lote segura o lance até o prazo passar e ele é recusado", async () => {
    const bidder = await fx.bidder(50000n);
    const lotId = await fx.lot(seller, { endsInMs: 1_500 });
    const holder = await fx.pool.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT id FROM lots WHERE id = $1 FOR UPDATE`, [lotId]);
      const pending = outcome(bid(bidder, lotId, 10000n));
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      await holder.query("COMMIT");
      expect(await pending).toBe("LOT_ENDED");
    } finally {
      holder.release();
    }
    expect(await fx.lotRow(lotId)).toMatchObject({ bids: 0, revision: 0 });
    expect(await fx.wallet(bidder.userId)).toMatchObject({ committed: 0n, reserved: 0n });
    await fx.assertInvariants([lotId]);
  });
});
