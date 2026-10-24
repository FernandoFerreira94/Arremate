import { describe, expect, it } from "vitest";
import { endsTodayBrt, formatGap, maskAlias, recentBidsWithGaps } from "./recent-bids-logic";

const bid = (sequence: number, at: string) => ({ alias: `Licitante ${sequence}`, amountCents: String(sequence * 1000), sequence, acceptedAt: at });

describe("recentBidsWithGaps", () => {
  it("ordena do mais recente e calcula o intervalo para o anterior", () => {
    const out = recentBidsWithGaps([bid(1, "2026-10-24T12:00:00Z"), bid(3, "2026-10-24T12:05:30Z"), bid(2, "2026-10-24T12:01:00Z")], 5);
    expect(out.map((b) => b.sequence)).toEqual([3, 2, 1]);
    expect(out.map((b) => b.gapMs)).toEqual([270_000, 60_000, null]);
  });
  it("respeita o limite mas usa o lance seguinte para o intervalo", () => {
    const out = recentBidsWithGaps([bid(1, "2026-10-24T12:00:00Z"), bid(2, "2026-10-24T12:00:10Z")], 1);
    expect(out).toHaveLength(1);
    expect(out[0].gapMs).toBe(10_000);
  });
  it("lista vazia", () => expect(recentBidsWithGaps([])).toEqual([]));
});

describe("formatGap", () => {
  it("formata", () => {
    expect(formatGap(null)).toBe("primeiro");
    expect(formatGap(45_000)).toBe("+45 s");
    expect(formatGap(180_000)).toBe("+3 min");
    expect(formatGap(7_800_000)).toBe("+2 h 10 min");
    expect(formatGap(100_800_000)).toBe("+1 d 4 h");
  });
});

describe("maskAlias", () => {
  it("encurta mantendo início e fim", () => {
    expect(maskAlias("Licitante 7")).toBe("Lic•••7");
    expect(maskAlias("Ana")).toBe("Ana•••");
  });
});

describe("endsTodayBrt", () => {
  it("usa o dia de Brasília", () => {
    const now = Date.parse("2026-10-24T18:00:00Z"); // 15h BRT
    expect(endsTodayBrt("2026-10-25T02:59:00Z", now)).toBe(true); // 23h59 BRT
    expect(endsTodayBrt("2026-10-25T03:01:00Z", now)).toBe(false); // 00h01 BRT do dia 25
  });
});
