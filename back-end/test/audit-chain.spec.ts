import { createHmac, timingSafeEqual } from "node:crypto";
import {
  canonicalBidBytes,
  canonicalCheckpointBytes,
  canonicalGenesisBytes,
  signBid,
  signCheckpoint,
  signGenesis,
  verifyBidSignature,
} from "../src/audit/audit-chain";
import type { CanonicalBid, Checkpoint, GenesisRecord } from "../src/audit/audit.types";

const KEY = Buffer.alloc(32, 0x11);

const CANONICAL_BID = Buffer.from(
  "v1\n" +
    "lotId=11111111-1111-4111-8111-111111111111\n" +
    "bidId=22222222-2222-4222-8222-222222222222\n" +
    "bidderUserId=33333333-3333-4333-8333-333333333333\n" +
    "sequence=1\n" +
    "amountCents=10000\n" +
    "acceptedAt=2026-10-23T18:01:02.003Z\n" +
    "previousSignature=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n" +
    "keyVersion=1\n" +
    "aliasBytes=15\n" +
    "Licitante café\n",
  "utf8",
);

const BID_SIGNATURE = "a52eef7cb581d7a50a049c43f2203e99e4ea621ae67b8bece15de74b151fc8d8";

const GENESIS_BYTES = Buffer.from(
  "v1\n" +
    "record=genesis\n" +
    "lotId=11111111-1111-4111-8111-111111111111\n" +
    "ownerId=44444444-4444-4444-8444-444444444444\n" +
    "snapshotId=55555555-5555-4555-8555-555555555555\n" +
    "initialCents=10000\n" +
    "incrementCents=500\n" +
    "startsAt=2026-10-23T18:00:00.000Z\n" +
    "endsAt=2026-10-23T19:00:00.000Z\n" +
    "keyVersion=1\n",
  "utf8",
);

const GENESIS_SIGNATURE = "389357c4b089e191122b7472b23de9a3dbe8357d7b955648fcd2bd8e96115c96";

const CHECKPOINT_BYTES = Buffer.from(
  "v1\n" +
    "record=checkpoint\n" +
    "lotId=11111111-1111-4111-8111-111111111111\n" +
    "revision=0\n" +
    "count=0\n" +
    "headSignature=389357c4b089e191122b7472b23de9a3dbe8357d7b955648fcd2bd8e96115c96\n" +
    "genesisSignature=389357c4b089e191122b7472b23de9a3dbe8357d7b955648fcd2bd8e96115c96\n" +
    "keyVersion=1\n" +
    "endsAt=2026-10-23T19:00:00.000Z\n" +
    "ownerId=44444444-4444-4444-8444-444444444444\n" +
    "snapshotId=55555555-5555-4555-8555-555555555555\n" +
    "initialCents=10000\n" +
    "incrementCents=500\n" +
    "startsAt=2026-10-23T18:00:00.000Z\n" +
    "genesisEndsAt=2026-10-23T19:00:00.000Z\n" +
    "settlementId=-\n" +
    "winnerBidId=-\n" +
    "receiptToken=-\n" +
    "settledAt=-\n",
  "utf8",
);

const CHECKPOINT_SIGNATURE = "d70bd22d7811646eb38f5643dca21bd665277bf922a1069daecc5a2e1d3af01e";

function bid(overrides: Partial<CanonicalBid> = {}): CanonicalBid {
  return {
    lotId: "11111111-1111-4111-8111-111111111111",
    bidId: "22222222-2222-4222-8222-222222222222",
    bidderUserId: "33333333-3333-4333-8333-333333333333",
    alias: "Licitante café",
    sequence: 1,
    amountCents: 10000n,
    acceptedAt: "2026-10-23T18:01:02.003Z",
    previousSignature: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    keyVersion: 1,
    ...overrides,
  };
}

function genesis(overrides: Partial<GenesisRecord> = {}): GenesisRecord {
  return {
    lotId: "11111111-1111-4111-8111-111111111111",
    ownerId: "44444444-4444-4444-8444-444444444444",
    snapshotId: "55555555-5555-4555-8555-555555555555",
    initialCents: 10000n,
    incrementCents: 500n,
    startsAt: "2026-10-23T18:00:00.000Z",
    endsAt: "2026-10-23T19:00:00.000Z",
    keyVersion: 1,
    ...overrides,
  };
}

function checkpoint(): Omit<Checkpoint, "envelopeSignature"> {
  return {
    lotId: "11111111-1111-4111-8111-111111111111",
    revision: 0,
    count: 0,
    headSignature: GENESIS_SIGNATURE,
    genesisSignature: GENESIS_SIGNATURE,
    keyVersion: 1,
    endsAt: "2026-10-23T19:00:00.000Z",
    ownerId: "44444444-4444-4444-8444-444444444444",
    snapshotId: "55555555-5555-4555-8555-555555555555",
    initialCents: 10000n,
    incrementCents: 500n,
    startsAt: "2026-10-23T18:00:00.000Z",
    genesisEndsAt: "2026-10-23T19:00:00.000Z",
    settlement: null,
  };
}

describe("cadeia canônica de auditoria", () => {
  it("fixa os bytes UTF-8, a ordem dos campos, o decimal, o instante e a versão", () => {
    expect(canonicalBidBytes(bid())).toEqual(CANONICAL_BID);
    expect(canonicalGenesisBytes(genesis())).toEqual(GENESIS_BYTES);
    expect(canonicalCheckpointBytes(checkpoint())).toEqual(CHECKPOINT_BYTES);
    expect(signCheckpoint(checkpoint(), KEY)).toBe(CHECKPOINT_SIGNATURE);
  });

  it("assina o lance e a gênese com HMAC-SHA-256 determinístico", () => {
    const event = bid();
    expect(signBid(event, event.previousSignature, KEY)).toBe(BID_SIGNATURE);
    expect(signGenesis(genesis(), KEY)).toBe(GENESIS_SIGNATURE);
    expect(createHmac("sha256", KEY).update(CANONICAL_BID).digest("hex")).toBe(BID_SIGNATURE);
  });

  it("invalida qualquer campo alterado, inclusive o usuário interno com o mesmo alias", () => {
    const original = signBid(bid(), bid().previousSignature, KEY);
    const changedUser = bid({ bidderUserId: "33333333-3333-4333-8333-333333333334" });
    expect(changedUser.alias).toBe("Licitante café");
    expect(signBid(changedUser, changedUser.previousSignature, KEY)).not.toBe(original);

    const variants: CanonicalBid[] = [
      bid({ lotId: "11111111-1111-4111-8111-111111111112" }),
      bid({ bidId: "22222222-2222-4222-8222-222222222223" }),
      bid({ alias: "Licitante cafe" }),
      bid({ sequence: 2 }),
      bid({ amountCents: 10001n }),
      bid({ acceptedAt: "2026-10-23T18:01:02.004Z" }),
      bid({ previousSignature: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
    ];
    for (const variant of variants) {
      expect(signBid(variant, variant.previousSignature, KEY)).not.toBe(original);
    }
    expect(() => signBid(bid({ keyVersion: 2 }), bid().previousSignature, KEY)).toThrow(/keyVersion/);
  });

  it("confere a assinatura com comparação de tempo constante e recusa tamanho diferente", () => {
    const event = bid();
    const signature = signBid(event, event.previousSignature, KEY);
    expect(verifyBidSignature(event, signature, KEY)).toBe(true);
    expect(verifyBidSignature(event, `${signature.slice(0, -1)}0`, KEY)).toBe(false);
    expect(verifyBidSignature(event, "abcd", KEY)).toBe(false);
    expect(timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signature, "hex"))).toBe(true);
  });
});
