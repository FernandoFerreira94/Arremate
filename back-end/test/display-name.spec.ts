import "reflect-metadata";
import { displayName } from "../src/auth/auth.controller";

describe("nome exibido (QA BAIXA 6)", () => {
  it("sem nome, mostra o papel", () => {
    expect(displayName(null, "BIDDER")).toBe("Licitante");
    expect(displayName(undefined, "AUCTIONEER")).toBe("Leiloeiro");
    expect(displayName("   ", "BIDDER")).toBe("Licitante");
    expect(displayName("Participante", "AUCTIONEER")).toBe("Leiloeiro");
  });
  it("com nome, mantém o nome", () => {
    expect(displayName("Ana", "AUCTIONEER")).toBe("Ana");
  });
});
