import { expect, test, type Page } from "@playwright/test";
import { ensureE2eUsers, type E2eUser, type E2eUsers } from "./support/demo-users";

let users: E2eUsers;

test.beforeAll(async () => {
  users = await ensureE2eUsers();
});

async function loginUi(page: Page, user: E2eUser, from = "/entrar") {
  await page.goto(from);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function walletTotal(page: Page): Promise<bigint> {
  const response = await page.request.get("/api/wallet");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { totalCents: string };
  return BigInt(body.totalCents);
}

test("licitante: redireciona, preserva email, deposita uma vez, não vê painel e não volta a ver dados após sair", async ({ page }) => {
  await page.goto("/carteira");
  await expect(page).toHaveURL(/\/entrar\?returnTo=%2Fcarteira/);

  await page.getByLabel("Email").fill(users.bidder.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Email ou senha incorretos.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(users.bidder.email);
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");

  await page.getByLabel("Senha", { exact: true }).fill(users.bidder.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/carteira$/);
  await expect(page.getByRole("heading", { name: "Minha carteira" })).toBeVisible();

  const before = await walletTotal(page);
  const amount = page.getByLabel("Valor (R$)");
  await amount.fill("0,50");
  await page.getByRole("button", { name: "Adicionar saldo" }).click();
  await expect(page.getByText("Entre R$ 1,00 e R$ 100.000,00 por depósito.").last()).toBeVisible();
  await expect(amount).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "R$ 1.000" }).click();
  await expect(page.getByText("Valor entendido: R$ 1.000,00")).toBeVisible();
  const submit = page.getByRole("button", { name: "Adicionar saldo" });
  await submit.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(submit).toBeFocused();

  await submit.click();
  await page.getByRole("button", { name: "Confirmar depósito" }).click();
  await expect(page.getByText("Depósito de R$ 1.000,00 confirmado.")).toBeVisible();
  expect((await walletTotal(page)) - before).toBe(100000n);

  await page.goto("/painel/lotes");
  await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
  expect((await page.request.get("/api/seller/lots")).status()).toBe(403);

  await page.goto("/carteira");
  await expect(page.getByTestId("saldo-total")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.goBack();
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByTestId("saldo-total")).toHaveCount(0);
  expect((await page.request.get("/api/wallet")).status()).toBe(401);
});

test("leiloeiro: painel próprio, carteira negada e publicação mantém campos com erro associado", async ({ page }) => {
  await loginUi(page, users.auctioneer);
  await expect(page).toHaveURL(/\/painel\/lotes$/);
  await expect(page.getByRole("heading", { name: "Meus lotes" })).toBeVisible();
  await expect(page.getByTestId("total-recebido")).toBeVisible();

  await page.goto("/carteira");
  await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
  expect((await page.request.get("/api/wallet")).status()).toBe(403);

  await page.goto("/painel/lotes/novo");
  await page.getByLabel("Lance inicial (R$)").fill("abc");
  await page.getByLabel("Incremento mínimo (R$)").fill("1.000");
  await page.getByRole("button", { name: "Publicar lote" }).click();
  await expect(page.getByText("Escolha uma obra do catálogo.")).toBeVisible();
  await expect(page.getByLabel("Lance inicial (R$)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Lance inicial (R$)")).toHaveValue("abc");
  await expect(page.getByLabel("Incremento mínimo (R$)")).toHaveValue("1.000");
  await expect(page.getByLabel("Início")).toHaveAttribute("aria-invalid", "true");
});

test.describe("mobile 390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("licitante navega pelo menu e abre o depósito na folha inferior", async ({ page }) => {
    await loginUi(page, users.bidder, "/entrar?returnTo=%2Fmeus-arremates");
    await expect(page.getByRole("heading", { name: "Meus arremates" })).toBeVisible();
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("navigation", { name: "Menu móvel" }).getByRole("link", { name: "Carteira" }).click();
    await expect(page.getByRole("heading", { name: "Minha carteira" })).toBeVisible();
    await page.getByRole("button", { name: "Adicionar saldo" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Valor (R$)")).toBeVisible();
  });
});
