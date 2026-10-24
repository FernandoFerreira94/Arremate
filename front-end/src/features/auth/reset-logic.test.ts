import { describe, expect, it } from "vitest";
import { isPlausibleEmail, passwordStrength, RESET_SENT_MESSAGE } from "./reset-logic";

describe("redefinição simulada", () => {
  it("mensagem neutra fixa", () => expect(RESET_SENT_MESSAGE).toBe("Se o e-mail existir, enviamos um link."));
  it("valida o formato do e-mail", () => {
    expect(isPlausibleEmail("ana@exemplo.com")).toBe(true);
    expect(isPlausibleEmail("ana@")).toBe(false);
  });
});

describe("passwordStrength", () => {
  it("vai de 0 a 4", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("Abcdefghijkl")).toBe(3);
    expect(passwordStrength("Abcdefghijk1!")).toBe(4);
  });
});
