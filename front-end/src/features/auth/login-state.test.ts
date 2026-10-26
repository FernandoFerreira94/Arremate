import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api-error";
import { afterLoginFailure, demoLoginEnabled, safeReturnTo } from "./login-state";

describe("login", () => {
  it("preserva o email e limpa a senha depois de falha, com mensagem genérica", () => {
    const next = afterLoginFailure(
      { email: "ana@demo.test", password: "errada" },
      new ApiError({ statusCode: 401, code: "CREDENCIAIS_INVALIDAS", message: "x", requestId: "r" }),
    );
    expect(next.values).toEqual({ email: "ana@demo.test", password: "" });
    expect(next.message).toBe("Email ou senha incorretos.");
  });
  it("limite de tentativas tem mensagem própria", () => {
    const next = afterLoginFailure({ email: "a@b.c", password: "x" }, new ApiError({ statusCode: 429, code: "LIMITE", message: "x", requestId: "" }));
    expect(next.message).toMatch(/Muitas tentativas/);
  });
  it("returnTo só aceita caminho interno", () => {
    expect(safeReturnTo("/carteira")).toBe("/carteira");
    expect(safeReturnTo("//evil.test")).toBeUndefined();
    expect(safeReturnTo("https://evil.test")).toBeUndefined();
    expect(safeReturnTo(null)).toBeUndefined();
  });
});

describe("login demo (D27)", () => {
  it("fica ligado sem a variável e só desliga com false explícito", () => {
    expect(demoLoginEnabled(undefined)).toBe(true);
    expect(demoLoginEnabled("")).toBe(true);
    expect(demoLoginEnabled("true")).toBe(true);
    expect(demoLoginEnabled("false")).toBe(false);
    expect(demoLoginEnabled(" FALSE ")).toBe(false);
  });
});
