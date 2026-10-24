import { describe, expect, it } from "vitest";
import { cutoutFor, stepsFor, TOUR_STEPS } from "./tour-steps";

describe("tour", () => {
  it("tem 7 passos na ordem da prancha", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(["nav", "balance", "card", "favorite", "bids", "room", "profile"]);
  });
  it("pula saldo para leiloeiro e passos sem alvo", () => {
    const ids = stepsFor("AUCTIONEER", (s) => s.id !== "room").map((s) => s.id);
    expect(ids).toEqual(["nav", "card", "favorite", "bids", "profile"]);
  });
  it("recorte segue o retângulo + 8 px e o raio do elemento", () => {
    expect(cutoutFor({ top: 10, left: 20, width: 100, height: 40 }, 6, 10)).toEqual({ top: 2, left: 12, width: 116, height: 56, radius: 14 });
    expect(cutoutFor({ top: 0, left: 0, width: 1, height: 1 }, 0, 10).radius).toBe(18);
  });
});
