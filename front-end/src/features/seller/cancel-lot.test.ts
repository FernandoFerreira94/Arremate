import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api-error";
import { cancelWithRefresh } from "./cancel-lot";

describe("cancelamento", () => {
  it("recusado (lance chegou antes) atualiza o painel e devolve mensagem", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const cancel = vi.fn().mockRejectedValue(new ApiError({ statusCode: 409, code: "LOTE_COM_LANCES", message: "x", requestId: "" }));
    const outcome = await cancelWithRefresh(client, cancel, "lote-1");
    expect(outcome).toEqual({ ok: false, message: "Não deu para cancelar: o lote recebeu um lance. A lista foi atualizada." });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["seller"] });
  });
  it("sucesso também atualiza", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const outcome = await cancelWithRefresh(client, vi.fn().mockResolvedValue({}), "lote-1");
    expect(outcome.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["seller"] });
  });
});
