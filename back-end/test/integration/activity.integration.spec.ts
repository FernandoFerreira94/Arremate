import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "../../src/app";
import type { Actor } from "../../src/auth/auth.service";
import { hashPassword } from "../../src/auth/password-hash";
import { BiddingFixture, money } from "../support/bidding-fixture";
import { ORIGIN, PASSWORD, Session } from "../support/http-session";

/** D32: feed ao vivo de lances de outras pessoas, só com sessão, sem o próprio lance e sem o passado. */
describe("feed de lances ao vivo (D32)", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("d32-feed-", connectionString);
  let app: INestApplication;
  let seller: Actor;
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
    await fx.init();
    seller = await fx.user("AUCTIONEER");
    app = await createApplication({ connectionString, logger: false, allowedOrigins: [ORIGIN], auditKey: fx.key, witnessDir: join(fx.dir, "witness"), settlementIntervalMs: false, notificationIntervalMs: false, demoBots: false });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await fx.cleanup();
  });

  it("exige sessão e valida o cursor", async () => {
    expect((await new Session(app).get("/api/me/activity")).status).toBe(401);
    const me = await fx.bidder(0n, passwordHash);
    const session = new Session(app);
    await session.login(me.email);
    expect((await session.get("/api/me/activity?after=ontem")).status).toBe(400);
  });

  it("sem cursor não traz o passado; depois traz só lances de outras pessoas, em ordem, com o título da obra", async () => {
    const lotId = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    const me = await fx.bidder(100000n, passwordHash);
    const other = await fx.bidder(100000n);
    await fx.service.placeBid(other, lotId, money(10000n), randomUUID());
    const session = new Session(app);
    await session.login(me.email);
    const start = await session.get("/api/me/activity");
    expect(start.status).toBe(200);
    expect(start.body.items).toEqual([]);

    await fx.service.placeBid(me, lotId, money(10500n), randomUUID());
    await fx.service.placeBid(other, lotId, money(11000n), randomUUID());
    const next = await session.get(`/api/me/activity?after=${encodeURIComponent(start.body.cursor as string)}`);
    expect(next.status).toBe(200);
    type Item = { id: string; amountCents: string; acceptedAt: string };
    const latest = (next.body.items as Item[]).at(-1);
    expect(latest).toEqual(expect.objectContaining({ lotId, title: "Obra de teste", amountCents: "11000", alias: expect.stringMatching(/^Licitante \d+$/) }));
    expect((next.body.items as Item[]).map((item) => item.amountCents)).not.toContain("10500");
    expect(next.body.cursor).toBe(latest?.acceptedAt);
    // A janela de 5 s para trás pode repetir itens já vistos (o feed descarta por id), nunca traz um novo antigo demais.
    const again = await session.get(`/api/me/activity?after=${encodeURIComponent(next.body.cursor as string)}`);
    const seen = new Set((next.body.items as Item[]).map((item) => item.id));
    expect((again.body.items as Item[]).every((item) => seen.has(item.id))).toBe(true);
    expect(again.body.cursor).toBe(next.body.cursor);
  });

  it("não perde lance que confirmou depois do cursor com horário anterior (auditoria item 11)", async () => {
    const lotId = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    const me = await fx.bidder(100000n, passwordHash);
    const other = await fx.bidder(100000n);
    const session = new Session(app);
    await session.login(me.email);
    await fx.service.placeBid(other, lotId, money(10000n), randomUUID());
    const first = await session.get(`/api/me/activity?after=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}`);
    const cursor = first.body.cursor as string;
    // Lance que entra depois da leitura, mas com relógio 2 s antes do cursor (commit fora de ordem).
    const third = await fx.bidder(100000n);
    await fx.service.placeBid(third, lotId, money(10500n), randomUUID());
    await fx.pool.query(`UPDATE bids SET accepted_at = $2::timestamptz - interval '2 seconds' WHERE lot_id = $1 AND amount_cents = 10500`, [lotId, cursor]);
    const late = await session.get(`/api/me/activity?after=${encodeURIComponent(cursor)}`);
    expect((late.body.items as Array<{ amountCents: string }>).map((item) => item.amountCents)).toContain("10500");
  });

  it("participações filtram por lote, para a sala não depender da 1ª página (auditoria item 12)", async () => {
    const me = await fx.bidder(100000n, passwordHash);
    const first = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    const second = await fx.lot(seller, { initialCents: 10000n, incrementCents: 500n });
    await fx.service.placeBid(me, first, money(10000n), randomUUID());
    await fx.service.placeBid(me, second, money(10000n), randomUUID());
    const session = new Session(app);
    await session.login(me.email);
    const only = await session.get(`/api/me/participations?lotId=${second.toUpperCase()}`);
    expect(only.status).toBe(200);
    expect(only.body.total).toBe(1);
    expect(only.body.items.map((item: { lotId: string }) => item.lotId)).toEqual([second]);
    expect((await session.get("/api/me/participations")).body.total).toBe(2);
    expect((await session.get("/api/me/participations?lotId=nao-e-uuid")).status).toBe(400);
  });
});
