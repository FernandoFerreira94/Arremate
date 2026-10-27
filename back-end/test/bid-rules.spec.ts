import { ANTI_SNIPING_MS, BidRejection, decideBid, type BidContext } from "../src/lots/bid-rules";

const START = new Date("2026-10-23T12:00:00.000Z");
const END = new Date("2026-10-23T13:00:00.000Z");

function context(overrides: Partial<BidContext> = {}): BidContext {
  return {
    status: "PUBLISHED",
    startsAt: START,
    endsAt: END,
    initialCents: 10000n,
    incrementCents: 500n,
    currentCents: null,
    actorIsLeader: false,
    actorIsOwner: false,
    availableCents: 1_000_000n,
    amountCents: 10000n,
    now: new Date(START.getTime() + 60_000),
    ...overrides,
  };
}

function rejection(input: BidContext): string {
  try {
    decideBid(input);
  } catch (error) {
    if (error instanceof BidRejection) return error.code;
    throw error;
  }
  return "ACEITO";
}

describe("regras de lance", () => {
  it("valor inicial 10000 aceita 10000 e recusa 9999", () => {
    expect(rejection(context({ amountCents: 10000n }))).toBe("ACEITO");
    expect(rejection(context({ amountCents: 9999n }))).toBe("BID_BELOW_MINIMUM");
  });

  it("atual 10000 + incremento 500 aceita 10500 e recusa 10499", () => {
    expect(rejection(context({ currentCents: 10000n, amountCents: 10500n }))).toBe("ACEITO");
    expect(rejection(context({ currentCents: 10000n, amountCents: 10499n }))).toBe("BID_BELOW_MINIMUM");
  });

  it("líder não repete lance mesmo com saldo", () => {
    expect(rejection(context({ currentCents: 10000n, actorIsLeader: true, amountCents: 20000n }))).toBe("ALREADY_LEADING");
  });

  it("recusa sem saldo disponível para reservar o valor inteiro", () => {
    expect(rejection(context({ availableCents: 9999n }))).toBe("INSUFFICIENT_FUNDS");
    expect(rejection(context({ availableCents: 10000n }))).toBe("ACEITO");
  });

  it("aceita no início exato e recusa antes e no fim exato", () => {
    expect(rejection(context({ now: START }))).toBe("ACEITO");
    expect(rejection(context({ now: new Date(START.getTime() - 1) }))).toBe("LOT_NOT_STARTED");
    expect(rejection(context({ now: END }))).toBe("LOT_ENDED");
  });

  it("distingue lote cancelado e encerrado pelo estado", () => {
    expect(rejection(context({ status: "CANCELLED" }))).toBe("LOT_CANCELLED");
    expect(rejection(context({ status: "CLOSED_PENDING" }))).toBe("LOT_ENDED");
  });

  it("restando 121s ou 120s mantém o fim; 119s e 1s estendem para aceite + 120s", () => {
    for (const [remaining, extends_] of [[121_000, false], [120_000, false], [119_000, true], [1_000, true]] as const) {
      const now = new Date(END.getTime() - remaining);
      const decision = decideBid(context({ now }));
      expect(decision.endsAt.getTime()).toBe(extends_ ? now.getTime() + ANTI_SNIPING_MS : END.getTime());
      expect(decision.extended).toBe(extends_);
    }
  });

  it("rejeição nunca estende o prazo", () => {
    const now = new Date(END.getTime() - 1_000);
    expect(() => decideBid(context({ now, amountCents: 1n }))).toThrow(BidRejection);
  });
});

describe("dono do lote (auditoria item 16)", () => {
  it("recusa lance no próprio lote antes de qualquer outra regra de valor", () => {
    expect(rejection(context({ actorIsOwner: true }))).toBe("OWN_LOT");
    expect(rejection(context({ actorIsOwner: true, amountCents: 1n }))).toBe("OWN_LOT");
  });
});
