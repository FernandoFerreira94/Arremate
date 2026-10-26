import { expect, it, vi } from "vitest";
import { deposit } from "./wallet-api";
import { apiFetch } from "../../lib/api";
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
it("envia método e cartão escolhido junto à intenção idempotente, sem PAN/CVV", async () => {
  await deposit("500000", "idempotente", { method: "CARD", cardId: "cartao-1" });
  expect(apiFetch).toHaveBeenCalledWith("/api/wallet/deposits", { method: "POST", body: JSON.stringify({ amountCents: "500000", method: "CARD", cardId: "cartao-1" }), headers: { "Idempotency-Key": "idempotente" } });
});
