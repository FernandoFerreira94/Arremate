import { lotState } from "../src/lots/lots.service";

describe("lotState", () => {
  const start = new Date("2026-10-23T12:00:00.000Z");
  const end = new Date("2026-10-23T13:00:00.000Z");
  it("deriva agendado, ao vivo, encerrado e cancelado do relógio do servidor", () => {
    expect(lotState("PUBLISHED", start, end, new Date("2026-10-23T11:59:59.999Z"))).toBe("SCHEDULED");
    expect(lotState("PUBLISHED", start, end, start)).toBe("LIVE");
    expect(lotState("PUBLISHED", start, end, new Date("2026-10-23T12:59:59.999Z"))).toBe("LIVE");
    expect(lotState("PUBLISHED", start, end, end)).toBe("ENDED");
    expect(lotState("CANCELLED", start, end, start)).toBe("CANCELLED");
    expect(lotState("SETTLED", start, end, start)).toBe("ENDED");
  });
});
