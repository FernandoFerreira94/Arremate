import { describe, expect, it } from "vitest";
import { preferenceOf, resolveTheme } from "./theme";

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

describe("preferenceOf (menu Claro, Escuro, Sistema)", () => {
  it("sem escolha salva ou valor inválido é Sistema", () => {
    expect(preferenceOf(null)).toBe("system");
    expect(preferenceOf("roxo")).toBe("system");
    expect(preferenceOf("dark")).toBe("dark");
    expect(preferenceOf("light")).toBe("light");
  });
});
