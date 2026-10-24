import { expect, test } from "@playwright/test";
import { ensureE2eUsers, type E2eUsers } from "./support/demo-users";

let users: E2eUsers;

test.beforeAll(async () => {
  users = await ensureE2eUsers();
});

test.describe("rodada 3 (D19)", () => {
  test("Entrar abre a Sheet com abas e a redefinição é simulada e neutra", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("tab", { name: /Entrar/ })).toBeVisible();
    await sheet.getByRole("tab", { name: /Redefinir/ }).click();
    await sheet.getByLabel("E-mail").fill("ninguem@exemplo.com");
    await sheet.getByRole("button", { name: "Enviar link" }).click();
    await expect(sheet.getByText("Se o e-mail existir, enviamos um link.")).toBeVisible();
  });

  test("login pela Sheet mantém a página e abre o menu da conta", async ({ page }) => {
    await page.goto("/como-funciona");
    await page.getByRole("button", { name: "Entrar" }).first().click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Email").fill(users.bidder.email);
    await sheet.getByLabel("Senha", { exact: true }).fill(users.bidder.password);
    await sheet.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/como-funciona$/);
    await page.getByRole("button", { name: "Menu da conta" }).click();
    await expect(page.getByRole("menuitem", { name: "Creditar saldo" })).toBeVisible();
  });

  test("páginas novas respondem", async ({ page }) => {
    await page.goto("/suporte");
    await expect(page.getByRole("heading", { level: 1, name: /Suporte/ })).toBeVisible();
    await page.getByLabel("Buscar nas perguntas").fill("xyzzy");
    await expect(page.getByText("Nenhuma pergunta encontrada")).toBeVisible();
    await page.goto("/como-funciona");
    await expect(page.getByRole("heading", { level: 1, name: "Como funciona" })).toBeVisible();
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { level: 1, name: "Perfil" })).toBeVisible();
  });

  test("abas da vitrine são endereçáveis", async ({ page }) => {
    await page.goto("/?aba=agendados");
    await expect(page.getByRole("tab", { name: /Agendados/ })).toHaveAttribute("data-state", "active");
  });
});
