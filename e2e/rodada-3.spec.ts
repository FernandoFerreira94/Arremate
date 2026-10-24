import { expect, test } from "@playwright/test";
import { ensureE2eUsers, type E2eUsers } from "./support/demo-users";
import { markTourSeen } from "./support/tour";

let users: E2eUsers;

test.beforeAll(async () => {
  users = await ensureE2eUsers();
});

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
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

  test("login rápido de teste usa o login normal com a conta de demo", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Ambiente de demonstração", { exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Entrar como leiloeiro de teste" })).toBeVisible();
    const request = page.waitForRequest((r) => r.method() === "POST" && /\/auth\/login/.test(r.url()));
    await sheet.getByRole("button", { name: "Entrar como licitante de teste" }).click();
    const body = (await request).postDataJSON() as { email: string; password: string };
    expect(body).toMatchObject({ email: "licitante1@arremate.demo", password: "arremate-demo-2026" });
    await page.goto("/entrar");
    await expect(page.getByRole("button", { name: "Entrar como licitante de teste" })).toBeVisible();
  });
});
