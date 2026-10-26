import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { endSession, registerPrivateChannel } from "./session-query";

describe("encerramento da sessão no cliente", () => {
  it("revoga, fecha o canal, limpa o que é privado e só então redireciona", async () => {
    const order: string[] = [];
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], { role: "BIDDER" });
    queryClient.setQueryData(["public", "lots"], [{ id: "lote" }]);
    registerPrivateChannel(() => order.push("sse"));
    const logout = vi.fn(async () => {
      order.push("logout");
    });

    await endSession(queryClient, logout, () => {
      order.push("redirect");
      expect(queryClient.getQueryData(["session"])).toBeNull();
      expect(queryClient.getQueryData(["public", "lots"])).toEqual([{ id: "lote" }]);
    });

    expect(order).toEqual(["logout", "sse", "redirect"]);
  });
});
