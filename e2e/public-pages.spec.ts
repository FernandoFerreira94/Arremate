import { expect, test } from "@playwright/test";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

test("vitrine pública: título, abas e estado vazio ou cartões, sem login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Leilões de arte de acervo público" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Ao vivo/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Agendados/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Encerrados/ })).toBeVisible();
  await expect(page.getByText(/Nenhum lote ao vivo|Abrir sala/).first()).toBeVisible();
  await page.getByRole("tab", { name: /Agendados/ }).click();
  await expect(page.getByText(/Nenhum lote agendado|Abrir sala/).first()).toBeVisible();
});

test("comprovante com token válido mas inexistente mostra erro real, sem selo positivo", async ({ page }) => {
  await page.goto(`/comprovantes/${"A".repeat(32)}`);
  await expect(page.getByText("Comprovante não encontrado. Confira o link recebido.")).toBeVisible();
  await expect(page.getByText("Íntegro.")).toHaveCount(0);
});
