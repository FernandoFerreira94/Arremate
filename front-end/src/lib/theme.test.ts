import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("escolha salva vence o sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("sem escolha (ou valor inválido) segue o sistema", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme("roxo", false)).toBe("light");
  });
});
