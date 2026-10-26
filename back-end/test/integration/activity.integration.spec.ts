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
    expect(next.body.items).toEqual([expect.objectContaining({ lotId, title: "Obra de teste", amountCents: "11000", alias: expect.stringMatching(/^Licitante \d+$/) })]);
    expect(next.body.cursor).toBe(next.body.items[0].acceptedAt);
    const again = await session.get(`/api/me/activity?after=${encodeURIComponent(next.body.cursor as string)}`);
    expect(again.body.items).toEqual([]);
  });
});
