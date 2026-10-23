import { describe, expect, it } from "vitest";
import { brtInputToUtcIso, formatBrt } from "./datetime";

describe("data/hora do formulário em horário de Brasília", () => {
  it("converte para UTC determinístico, sem depender do fuso da máquina", () => {
    expect(brtInputToUtcIso("2026-10-24T10:00")).toBe("2026-10-24T13:00:00.000Z");
    expect(brtInputToUtcIso("2026-12-31T23:30")).toBe("2027-01-01T02:30:00.000Z");
  });
  it("recusa texto inválido", () => {
    expect(brtInputToUtcIso("24/10/2026 10:00")).toBeNull();
    expect(brtInputToUtcIso("2026-02-30T10:00")).toBeNull();
  });
  it("exibe em BRT", () => {
    expect(formatBrt("2026-10-24T13:00:00.000Z")).toBe("24/10/2026 10:00");
  });
});
