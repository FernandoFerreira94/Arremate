import { expect, test } from "@playwright/test";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

test("senha pode ser mostrada e ocultada pelo botão de olho, com rótulo acessível", async ({ page }) => {
  await page.goto("/entrar");
  const password = page.getByLabel("Senha", { exact: true });
  await password.fill("segredo-de-teste");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(password).toHaveAttribute("type", "password");
});