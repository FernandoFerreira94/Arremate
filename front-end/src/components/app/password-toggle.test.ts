import { describe, expect, it } from "vitest";
import { passwordToggle } from "./password-toggle";

describe("passwordToggle", () => {
  it("começa oculta e oferece mostrar", () => {
    expect(passwordToggle(false)).toEqual({ type: "password", label: "Mostrar senha" });
  });
  it("visível vira texto e oferece ocultar", () => {
    expect(passwordToggle(true)).toEqual({ type: "text", label: "Ocultar senha" });
  });
});
