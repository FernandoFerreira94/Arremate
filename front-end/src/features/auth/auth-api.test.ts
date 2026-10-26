import { describe, expect, it, vi } from "vitest";
import { currentSession } from "./auth-api";
import { apiFetch } from "../../lib/api";
vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
it("conserva nome e id retornados por auth/me para perfil e tour", async () => {
  vi.mocked(apiFetch).mockResolvedValue({ role: "BIDDER", userId: "usuario-1", name: "Ana Ribeiro" });
  expect(await currentSession()).toEqual({ role: "BIDDER", userId: "usuario-1", name: "Ana Ribeiro" });
});
describe("cadastro", () => {
  it("não aceita uma sessão sem nome e id", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ role: "BIDDER" });
    await expect(currentSession()).rejects.toThrow();
  });
});
