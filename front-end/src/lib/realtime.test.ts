import { describe, expect, it } from "vitest";
import { createRevisionGate, POLL_MS, HEARTBEAT_TIMEOUT_MS } from "./realtime";

describe("createRevisionGate", () => {
  it("aceita só revisão maior; duplicado ou fora de ordem não regride", () => {
    const gate = createRevisionGate();
    expect(gate.accept(1)).toBe(true);
    expect(gate.accept(1)).toBe(false);
    expect(gate.accept(3)).toBe(true);
    expect(gate.accept(2)).toBe(false);
    expect(gate.current()).toBe(3);
  });

  it("reset na reconexão aceita a nova sequência do servidor reiniciado", () => {
    const gate = createRevisionGate();
    gate.accept(9);
    gate.reset();
    expect(gate.accept(1)).toBe(true);
  });

  it("valores inválidos são ignorados", () => {
    const gate = createRevisionGate();
    expect(gate.accept(Number.NaN)).toBe(false);
    expect(gate.accept(-1)).toBe(false);
  });

  it("polling degradado a cada 10s e heartbeat com folga sobre 15s", () => {
    expect(POLL_MS).toBe(10_000);
    expect(HEARTBEAT_TIMEOUT_MS).toBeGreaterThan(15_000);
  });
});
