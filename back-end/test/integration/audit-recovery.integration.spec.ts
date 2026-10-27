import "reflect-metadata";
import type { Actor } from "../../src/auth/auth.service";
import { BiddingFixture, money, outcome } from "../support/bidding-fixture";

/** Auditoria item 3: intenção pendente não pode travar o lote para sempre, nem ser reassinada às cegas. */
describe("nova tentativa da testemunha", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  const fx = new BiddingFixture("audit-retry-", connectionString);
  let seller: Actor;

  beforeAll(async () => {
    await fx.init();
    seller = await fx.user("AUCTIONEER");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("confirma a intenção que o banco gravou e libera o lote", async () => {
    const lotId = await fx.lot(seller);
    const bidder = await fx.bidder(50000n);
    fx.store.failNextAdvance = "write";
    expect(await outcome(fx.service.placeBid(bidder, lotId, money(10000n), "11111111-1111-4111-8111-111111111111"))).toBe("CONFIRMATION_PENDING");
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INDETERMINATE");

    const summary = await fx.audit.recoverPending();
    expect(summary).toMatchObject({ confirmed: 1, blocked: [] });
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    expect(await fx.store.readPending(lotId)).toBeNull();
    await fx.assertInvariants([lotId]);
  });

  it("descarta a intenção que o banco não gravou e mantém o banco como estava", async () => {
    const lotId = await fx.lot(seller);
    const committed = await fx.store.read(lotId);
    if (!committed) throw new Error("gênese ausente");
    await fx.store.writePending({ ...committed, revision: committed.revision + 1 });
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INDETERMINATE");

    expect(await fx.audit.recoverPending()).toMatchObject({ discarded: 1, blocked: [] });
    expect((await fx.audit.verifyLot(lotId)).status).toBe("INTACT");
    expect(await fx.store.read(lotId)).toMatchObject({ revision: committed.revision, envelopeSignature: committed.envelopeSignature });
  });

  it("banco adulterado continua bloqueado: nada é reassinado", async () => {
    const lotId = await fx.lot(seller);
    const bidder = await fx.bidder(50000n);
    fx.store.failNextAdvance = "write";
    expect(await outcome(fx.service.placeBid(bidder, lotId, money(10000n), "22222222-2222-4222-8222-222222222222"))).toBe("CONFIRMATION_PENDING");
    await fx.pool.query(`UPDATE bids SET amount_cents = 99999 WHERE lot_id = $1`, [lotId]);
    const before = await fx.store.read(lotId);

    const summary = await fx.audit.recoverPending();
    expect(summary.blocked).toContain(lotId);
    expect(await fx.store.read(lotId)).toEqual(before);
    expect(await fx.store.readPending(lotId)).not.toBeNull();
  });
});
