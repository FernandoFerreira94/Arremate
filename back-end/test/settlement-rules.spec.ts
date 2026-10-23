import { lotResult } from "../src/lots/lots.service";
import { outcomeOf } from "../src/lots/settlement.service";

describe("resultado do lote e da participação", () => {
  const end = new Date("2026-10-23T13:00:00.000Z");
  const before = new Date("2026-10-23T12:59:59.999Z");
  it("distingue aberto, encerrado aguardando, liquidado, sem lances e cancelado", () => {
    expect(lotResult("PUBLISHED", end, before)).toBe("OPEN");
    expect(lotResult("PUBLISHED", end, end)).toBe("CLOSED_PENDING");
    expect(lotResult("SETTLED", end, end)).toBe("SETTLED");
    expect(lotResult("CLOSED_NO_BIDS", end, end)).toBe("CLOSED_NO_BIDS");
    expect(lotResult("CANCELLED", end, before)).toBe("CANCELLED");
  });
  it("vitória só depois de liquidar; superado ou encerrado sem liderar é perda", () => {
    expect(outcomeOf("PUBLISHED", true, end, before)).toBe("LEADING");
    expect(outcomeOf("PUBLISHED", false, end, before)).toBe("OUTBID");
    expect(outcomeOf("PUBLISHED", true, end, end)).toBe("PENDING");
    expect(outcomeOf("PUBLISHED", false, end, end)).toBe("LOST");
    expect(outcomeOf("SETTLED", true, end, end)).toBe("WON");
    expect(outcomeOf("SETTLED", false, end, end)).toBe("LOST");
  });
});
