import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "../../src/app";
import type { Actor } from "../../src/auth/auth.service";
import { hashPassword } from "../../src/auth/password-hash";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";
import { PASSWORD, Session } from "../support/http-session";
import { join } from "node:path";

describe("idempotência do lance", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("tarefa6-idem-", connectionString);
  let seller: Actor;
  let app: INestApplication;
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    await fx.init();
    seller = await fx.user("AUCTIONEER", passwordHash);
    app = await createApplication({
      connectionString,
      logger: false,
      allowedOrigins: ["http://127.0.0.1:3300"],
      auditKey: fx.key,
      witnessDir: join(fx.dir, "witness"),
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await fx.cleanup();
  });

  it("retryReturnsOriginalBid: mesma chave e corpo devolvem o mesmo bidId sem novo lance; corpo distinto é 409", async () => {
    const lotId = await fx.lot(seller);
    const bidder = await fx.bidder(50000n);
    const key = randomUUID();
    const [first, second] = await Promise.all([fx.service.placeBid(bidder, lotId, "10000", key), fx.service.placeBid(bidder, lotId, "10000", key)]);
    const third = await fx.service.placeBid(bidder, lotId, "10000", key);
    expect(second.bidId).toBe(first.bidId);
    expect(third.bidId).toBe(first.bidId);
    expect(await outcome(fx.service.placeBid(bidder, lotId, "10500", key))).toBe("IDEMPOTENCIA_CONFLITO");
    expect((await fx.lotRow(lotId)).bids).toBe(1);
    expect(await fx.wallet(bidder.userId)).toMatchObject({ committed: 10000n, reserved: 10000n });
    await fx.assertInvariants([lotId]);
  });

  it("falha depois do commit e antes da resposta: retry consulta a idempotência; lote fica bloqueado até confirmar", async () => {
    const lotId = await fx.lot(seller);
    const bidder = await fx.bidder(50000n);
    const other = await fx.bidder(50000n);
    const key = randomUUID();
    fx.store.failNextAdvance = "write";
    expect(await outcome(fx.service.placeBid(bidder, lotId, money(10000n), key))).toBe("CONFIRMATION_PENDING");
    const retry = await fx.service.placeBid(bidder, lotId, money(10000n), key);
    expect(retry.bid.sequence).toBe(1);
    expect((await fx.lotRow(lotId)).bids).toBe(1);
    expect(await outcome(fx.service.placeBid(other, lotId, money(10500n), randomUUID()))).toBe("CONFIRMATION_PENDING");
    expect(await fx.wallet(other.userId)).toMatchObject({ committed: 0n });
    await fx.audit.retryCheckpoint(lotId);
    expect(await outcome(fx.service.placeBid(other, lotId, money(10500n), randomUUID()))).toBe("ACEITO");
    await fx.assertInvariants([lotId]);
  });

  it("HTTP: licitante dá lance com chave; resposta pública sem IDs internos; leiloeiro e sem chave são recusados", async () => {
    const lotId = await fx.lot(seller);
    const bidder = await fx.bidder(50000n, passwordHash);
    const session = new Session(app);
    await session.login(bidder.email);
    const ok = await session.post(`/api/lots/${lotId}/bids`, { amountCents: "10000" }, { "Idempotency-Key": randomUUID() });
    expect({ status: ok.status, body: ok.body }).toMatchObject({ status: 201 });
    expect(ok.body).toMatchObject({ bid: { amountCents: "10000", sequence: 1 }, lotRevision: 1 });
    expect(typeof ok.body.walletRevision).toBe("number");
    expect(JSON.stringify(ok.body)).not.toContain(bidder.userId);
    const low = await session.post(`/api/lots/${lotId}/bids`, { amountCents: "1" }, { "Idempotency-Key": randomUUID() });
    expect(low.body).toMatchObject({ statusCode: 409, code: "ALREADY_LEADING" });
    expect(typeof low.body.message).toBe("string");
    const noKey = await session.post(`/api/lots/${lotId}/bids`, { amountCents: "20000" });
    expect(noKey.status).toBe(400);
    const sellerSession = new Session(app);
    await sellerSession.login((await fx.pool.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [seller.userId])).rows[0]!.email);
    const denied = await sellerSession.post(`/api/lots/${lotId}/bids`, { amountCents: "20000" }, { "Idempotency-Key": randomUUID() });
    expect(denied.status).toBe(403);
  });

  it("QA MÉDIA 5: quem é superado ganha uma notificação OUTBID; ser superado de novo reabre a mesma", async () => {
    const lotId = await fx.lot(seller);
    const first = await fx.bidder(50000n);
    const second = await fx.bidder(50000n);
    const rows = (userId: string) =>
      fx.pool.query<{ kind: string; read_at: Date | null }>(`SELECT kind, read_at FROM notifications WHERE user_id = $1 AND lot_id = $2`, [userId, lotId]);
    await fx.service.placeBid(first, lotId, money(10000n), randomUUID());
    expect((await rows(first.userId)).rows).toEqual([]);
    await fx.service.placeBid(second, lotId, money(10500n), randomUUID());
    expect((await rows(first.userId)).rows).toEqual([{ kind: "OUTBID", read_at: null }]);
    expect((await rows(second.userId)).rows).toEqual([]);
    await fx.pool.query(`UPDATE notifications SET read_at = clock_timestamp() WHERE user_id = $1`, [first.userId]);
    await fx.service.placeBid(first, lotId, money(11000n), randomUUID());
    await fx.service.placeBid(second, lotId, money(11500n), randomUUID());
    expect((await rows(first.userId)).rows).toEqual([{ kind: "OUTBID", read_at: null }]);
    expect((await rows(second.userId)).rows).toEqual([{ kind: "OUTBID", read_at: null }]);
    await fx.assertInvariants([lotId]);
  });
});
