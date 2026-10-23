import { describe, expect, it } from "vitest";
import { outcomeLabel, splitParticipations } from "./participations";

describe("meus arremates", () => {
  it("participação perdida não aparece como vitória", () => {
    const rows = [
      { lotId: "1", outcome: "LOST" as const },
      { lotId: "2", outcome: "WON" as const },
      { lotId: "3", outcome: "PENDING" as const },
      { lotId: "4", outcome: "LEADING" as const },
    ];
    const { open, finished } = splitParticipations(rows);
    expect(open.map((row) => row.lotId)).toEqual(["4"]);
    expect(finished.map((row) => row.lotId)).toEqual(["1", "2", "3"]);
    expect(outcomeLabel("LOST")).toBe("Não arrematado");
    expect(outcomeLabel("PENDING")).toBe("Apurando resultado");
    expect(outcomeLabel("WON")).toBe("Arrematado");
  });
});
