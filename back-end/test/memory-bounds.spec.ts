import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RateLimiter } from "../src/auth/rate-limit";
import { FileCheckpointStore } from "../src/audit/checkpoint-store";

describe("mapas em memória não crescem sem limite (auditoria item 14)", () => {
  it("o limitador descarta janelas vencidas", () => {
    let now = 1_000_000;
    const limits = new RateLimiter(() => now);
    for (let ip = 0; ip < 50; ip += 1) limits.consume("audit", `203.0.113.${ip}`);
    expect(limits.size()).toBe(50);
    now += 10 * 60_000;
    limits.consume("audit", "198.51.100.1");
    expect(limits.size()).toBe(1);
  });

  it("a fila por lote da testemunha some quando ninguém espera", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tails-"));
    try {
      const store = new FileCheckpointStore(dir);
      const lots = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
      await Promise.all(lots.flatMap((lotId) => [store.clearPending(lotId), store.clearPending(lotId)]));
      expect((store as unknown as { tails: Map<string, unknown> }).tails.size).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
