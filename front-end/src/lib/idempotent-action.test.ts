import { describe, expect, it, vi } from "vitest";
import { createIdempotentAction } from "./idempotent-action";

describe("ação com chave de idempotência", () => {
  it("duplo clique envia uma requisição só, com uma chave", async () => {
    let release: () => void = () => undefined;
    const send = vi.fn<(body: string, key: string) => Promise<string>>(() => new Promise<string>((resolve) => { release = () => resolve("ok"); }));
    const action = createIdempotentAction(send, () => "chave-1");
    const first = action.run("10000");
    const second = action.run("10000");
    release();
    await Promise.all([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("10000", "chave-1");
  });

  it("nova tentativa do mesmo corpo após falha reaproveita a chave; corpo novo gera chave nova", async () => {
    const keys = ["k1", "k2"];
    const send = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue("ok");
    const action = createIdempotentAction(send, () => keys.shift() ?? "kx");
    await expect(action.run("100")).rejects.toThrow("rede");
    await action.run("100");
    await action.run("200");
    expect(send.mock.calls.map((call) => call[1])).toEqual(["k1", "k1", "k2"]);
  });

  it("depois do sucesso, o mesmo valor é um novo depósito com chave nova", async () => {
    const keys = ["a", "b"];
    const send = vi.fn().mockResolvedValue("ok");
    const action = createIdempotentAction(send, () => keys.shift() ?? "z");
    await action.run("100");
    await action.run("100");
    expect(send.mock.calls.map((call) => call[1])).toEqual(["a", "b"]);
  });
});
