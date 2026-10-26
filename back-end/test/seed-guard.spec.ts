import { assertLocalDatabase, seedAllowsHosted } from "../prisma/seed";

describe("guarda do seed (deploy da demo)", () => {
  it("recusa banco remoto sem a liberação explícita", () => {
    expect(() => assertLocalDatabase("postgresql://u:p@postgres.railway.internal:5432/app")).toThrow("SEED_ALLOW_HOSTED=1");
  });
  it("aceita banco local e, com a liberação, banco remoto", () => {
    expect(() => assertLocalDatabase("postgresql://u:p@127.0.0.1:5462/app")).not.toThrow();
    expect(() => assertLocalDatabase("postgresql://u:p@postgres.railway.internal:5432/app", true)).not.toThrow();
  });
  it("só libera com o valor exato 1", () => {
    expect(seedAllowsHosted({ SEED_ALLOW_HOSTED: "1" })).toBe(true);
    expect(seedAllowsHosted({ SEED_ALLOW_HOSTED: "true" })).toBe(false);
    expect(seedAllowsHosted({})).toBe(false);
  });
});
