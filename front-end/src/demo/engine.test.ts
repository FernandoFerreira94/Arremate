import { describe, expect, it } from "vitest";
import { ANTI_SNIPING_MS, DemoFailure, createSeedState, handle, tamperLot, restoreLot, verifyChain, type DemoState } from "./engine";
import { sha256Hex } from "./sha256";

const T0 = Date.parse("2026-10-28T15:00:00Z");

function call(state: DemoState, method: string, path: string, body: Record<string, unknown> = {}, now = T0) {
  const url = new URL(path, "http://demo");
  return handle(state, { method, path: url.pathname, query: url.searchParams, body, idempotencyKey: null }, now).body as Record<string, unknown>;
}

function login(state: DemoState, who: string) {
  call(state, "POST", "/api/auth/login", { email: `${who}@arremate.demo`, password: "arremate-demo-2026" });
}

function failure(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof DemoFailure) return error.code;
  }
  return "OK";
}

const liveLot = (state: DemoState) => state.lots.find((l) => l.startsAt < T0 && l.endsAt - T0 > 60 * 60 * 1000 && state.bids.some((b) => b.lotId === l.id)) as DemoState["lots"][number];

describe("motor da demo", () => {
  it("sha256 confere com o vetor conhecido", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("semente: 36 lotes, encerrados liquidados e cadeias íntegras", () => {
    const state = createSeedState(T0);
    expect(state.lots).toHaveLength(36);
    const page = call(state, "GET", "/api/lots?page=1") as { total: number; counts: Record<string, number> };
    expect(page.total).toBe(36);
    expect(page.counts.ended).toBeGreaterThan(0);
    for (const lot of state.lots) expect(verifyChain(state, lot.id).status).toBe("INTACT");
    expect(Object.keys(state.receipts).length).toBeGreaterThan(0);
  });

  it("lance reserva o saldo do líder e libera o anterior", () => {
    const state = createSeedState(T0);
    const lot = liveLot(state);
    const previous = state.bids.filter((b) => b.lotId === lot.id).at(-1)!;
    const before = BigInt(state.wallets[previous.userId]!.committed);
    login(state, "licitante1");
    const minimum = (call(state, "GET", `/api/lots/${lot.id}`) as { minimumNextCents: string }).minimumNextCents;
    expect(failure(() => call(state, "POST", `/api/lots/${lot.id}/bids`, { amountCents: String(BigInt(minimum) - BigInt(1)) }))).toBe("BID_BELOW_MINIMUM");
    call(state, "POST", `/api/lots/${lot.id}/bids`, { amountCents: minimum });
    expect(BigInt(state.wallets[previous.userId]!.committed)).toBe(before - BigInt(previous.amountCents));
    const wallet = call(state, "GET", "/api/wallet") as { committedCents: string };
    expect(wallet.committedCents).toBe(minimum);
    expect(failure(() => call(state, "POST", `/api/lots/${lot.id}/bids`, { amountCents: String(BigInt(minimum) * BigInt(2)) }))).toBe("ALREADY_LEADING");
  });

  it("lance nos últimos 2 minutos estende o lote por mais 2", () => {
    const state = createSeedState(T0);
    const lot = liveLot(state);
    const late = lot.endsAt - 30_000;
    login(state, "licitante1");
    const minimum = (call(state, "GET", `/api/lots/${lot.id}`, {}, late) as { minimumNextCents: string }).minimumNextCents;
    const result = call(state, "POST", `/api/lots/${lot.id}/bids`, { amountCents: minimum }, late) as { extended: boolean; endsAt: string };
    expect(result.extended).toBe(true);
    expect(Date.parse(result.endsAt)).toBe(late + ANTI_SNIPING_MS);
  });

  it("no fim, debita o vencedor, credita o leiloeiro e emite comprovante", () => {
    const state = createSeedState(T0);
    const lot = liveLot(state);
    login(state, "licitante1");
    const minimum = (call(state, "GET", `/api/lots/${lot.id}`) as { minimumNextCents: string }).minimumNextCents;
    call(state, "POST", `/api/lots/${lot.id}/bids`, { amountCents: minimum });
    const after = lot.endsAt + 1000;
    const wallet = call(state, "GET", "/api/wallet", {}, after) as { totalCents: string; committedCents: string };
    expect(wallet.committedCents).toBe("0");
    expect(wallet.totalCents).toBe(String(BigInt(5_000_000) - BigInt(minimum)));
    const credit = state.entries.find((e) => e.userId === "u-leiloeiro" && e.kind === "SETTLEMENT_CREDIT" && e.reference === lot.art.title);
    expect(credit?.amountCents).toBe(minimum);
    const awards = call(state, "GET", "/api/me/awards", {}, after) as { items: { receiptToken: string }[] };
    expect(awards.items).toHaveLength(1);
    const receipt = call(state, "GET", `/api/receipts/${awards.items[0]!.receiptToken}`, {}, after) as { valid: boolean; amountCents: string };
    expect(receipt).toMatchObject({ valid: true, amountCents: minimum });
  });

  it("auditoria detecta alteração feita fora do fluxo de lances e volta a íntegra ao desfazer", () => {
    const state = createSeedState(T0);
    const lot = liveLot(state);
    expect(tamperLot(state, lot.id)).toBe(true);
    expect((call(state, "GET", `/api/lots/${lot.id}/audit`) as { status: string }).status).toBe("TAMPERED");
    expect(restoreLot(state, lot.id)).toBe(true);
    expect((call(state, "GET", `/api/lots/${lot.id}/audit`) as { status: string }).status).toBe("INTACT");
  });

  it("leiloeiro não dá lance e rotas privadas pedem sessão", () => {
    const state = createSeedState(T0);
    expect(failure(() => call(state, "GET", "/api/wallet"))).toBe("SESSAO_NECESSARIA");
    login(state, "leiloeiro");
    expect(failure(() => call(state, "POST", `/api/lots/${liveLot(state).id}/bids`, { amountCents: "999999" }))).toBe("ACESSO_NEGADO");
  });
});
