import { describe, expect, it } from "vitest";
import { rememberWelcome, WELCOME_KEY, welcomeSeen } from "./welcome-video";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

describe("welcomeSeen", () => {
  it("primeira visita: sem chave, o card aparece", () => {
    expect(welcomeSeen(fakeStorage())).toBe(false);
  });
  it("qualquer escolha gravada esconde o card", () => {
    expect(welcomeSeen(fakeStorage({ [WELCOME_KEY]: "dismissed" }))).toBe(true);
    expect(welcomeSeen(fakeStorage({ [WELCOME_KEY]: "watched" }))).toBe(true);
  });
  it("sem storage ou storage que lança, trata como visto", () => {
    expect(welcomeSeen(null)).toBe(true);
    expect(welcomeSeen({ getItem: () => { throw new Error("bloqueado"); }, setItem: () => undefined })).toBe(true);
  });
});

describe("rememberWelcome", () => {
  it("grava a escolha na chave versionada", () => {
    const store = fakeStorage();
    rememberWelcome("watched", store);
    expect(store.data.get(WELCOME_KEY)).toBe("watched");
  });
  it("não quebra quando o storage lança", () => {
    expect(() => rememberWelcome("dismissed", { getItem: () => null, setItem: () => { throw new Error("cheio"); } })).not.toThrow();
  });
});
