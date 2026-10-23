import { HttpException } from "@nestjs/common";
import { LotEventsService } from "../src/lots/lot-events.service";

function codeOf(work: () => unknown): string | null {
  try {
    work();
    return null;
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return `${error.getStatus()}:${String((error.getResponse() as { code?: string }).code)}`;
  }
}

const LOT = "0b7f8f0e-5d2f-4c55-9a51-3a1e0a6c1d01";
const OTHER = "0b7f8f0e-5d2f-4c55-9a51-3a1e0a6c1d02";

describe("LotEventsService", () => {
  it("entrega só ao lote assinado, com revisão crescente e sem dados de usuário", () => {
    const events = new LotEventsService();
    const got: unknown[] = [];
    const off = events.subscribe(LOT, (event) => got.push(event));
    events.subscribe(OTHER, () => got.push("errado"));
    events.publish(LOT);
    events.publish(LOT);
    off();
    events.publish(LOT);
    expect(got).toEqual([
      { type: "lot.updated", lotId: LOT, revision: 1 },
      { type: "lot.updated", lotId: LOT, revision: 2 },
    ]);
    expect(events.listenerCount(LOT)).toBe(0);
  });

  it("recusa assinatura acima do limite por lote e libera após cancelar", () => {
    const events = new LotEventsService(2, 10);
    const a = events.subscribe(LOT, () => undefined);
    events.subscribe(LOT, () => undefined);
    expect(codeOf(() => events.subscribe(LOT, () => undefined))).toBe("429:LIMITE_CONEXOES");
    a();
    expect(codeOf(() => events.subscribe(LOT, () => undefined))).toBeNull();
  });

  it("recusa acima do limite global", () => {
    const events = new LotEventsService(10, 1);
    events.subscribe(LOT, () => undefined);
    expect(codeOf(() => events.subscribe(OTHER, () => undefined))).toBe("429:LIMITE_CONEXOES");
  });

  it("falha de um ouvinte não impede os outros", () => {
    const events = new LotEventsService();
    const got: number[] = [];
    events.subscribe(LOT, () => {
      throw new Error("x");
    });
    events.subscribe(LOT, (event) => got.push(event.revision));
    events.publish(LOT);
    expect(got).toEqual([1]);
  });
});
