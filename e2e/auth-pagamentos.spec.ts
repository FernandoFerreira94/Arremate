import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D24: cadastro, login, depósitos simulados (Pix e cartão de teste) e histórico de lances, de ponta a ponta. */
test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

const NAME = "Ana Cadastro";
const PASSWORD = "cadastro-e2e-2026";

async function register(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("tab", { name: "Cadastrar" }).click();
  await sheet.locator("#register-name").fill(NAME);
  await sheet.locator("#register-email").fill(email);
  await sheet.locator("#register-password").fill(PASSWORD);
  await sheet.locator("#register-confirm").fill(PASSWORD);
  await sheet.getByRole("checkbox").check();
  await sheet.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/carteira\?conta=criada/);
  await expect(page.getByText("Conta criada. Adicione saldo simulado para dar lances.")).toBeVisible();
}

async function totalCents(page: Page): Promise<bigint> {
  const response = await page.request.get("/api/wallet");
  expect(response.status()).toBe(200);
  return BigInt(((await response.json()) as { totalCents: string }).totalCents);
}

test("cadastro, login, depósito Pix, depósito com cartão de teste e histórico de lances", async ({ page }) => {
  test.setTimeout(90000);
  const email = `e2e-cadastro-${randomUUID()}@arremate.test`;

  // Cadastro pela Sheet: sessão aberta, nome no header.
  await register(page, email);
  await expect(page.getByRole("button", { name: "Menu da conta" })).toContainText(NAME);

  // Logout e login por e-mail com a conta nova.
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toContainText(NAME);
  expect(((await (await page.request.get("/api/auth/me")).json()) as { name: string }).name).toBe(NAME);

  // Depósito Pix simulado.
  await page.goto("/carteira?aba=pix");
  const before = await totalCents(page);
  await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
  await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
  await expect(page.getByText("Pagamento simulado aprovado. Saldo atualizado.")).toBeVisible();
  expect((await totalCents(page)) - before).toBe(100000n);
  await expect(page.getByText("Depósito · Pix simulado")).toBeVisible();

  // Cartão de teste: guarda só bandeira, final e validade; depósito com cartão.
  await page.goto("/carteira?aba=cartao");
  await page.getByRole("button", { name: "Usar cartão de teste" }).click();
  await expect(page.getByText("Visa •••• 4242")).toBeVisible();
  const cards = (await (await page.request.get("/api/wallet/cards")).json()) as { items: Record<string, unknown>[] };
  expect(cards.items).toHaveLength(1);
  expect(JSON.stringify(cards.items)).not.toContain("4242424242424242");
  await page.getByRole("button", { name: "R$ 5.000", exact: true }).click();
  await page.getByRole("button", { name: /Pagar R\$ 5\.000,00 com cartão de teste/ }).click();
  await expect(page.getByText("Pagamento simulado aprovado. Saldo atualizado.")).toBeVisible();
  expect((await totalCents(page)) - before).toBe(600000n);
  await expect(page.getByText("Depósito · Cartão de teste •••• 4242")).toBeVisible();

  // Histórico: lance da conta nova num lote ao vivo aparece em Meus arremates › Histórico.
  const seller = await apiAs("auctioneer");
  try {
    const lotId = await publishLot(seller, { endsInMs: 30 * 60_000 });
    const csrf = ((await (await page.request.get("/api/auth/csrf")).json()) as { csrfToken: string }).csrfToken;
    const bid = await page.request.post(`/api/lots/${lotId}/bids`, { data: { amountCents: "10000" }, headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": csrf, "Idempotency-Key": randomUUID() } });
    expect(bid.status()).toBeLessThan(300);
    await page.goto("/meus-arremates?aba=historico");
    await expect(page.getByRole("tab", { name: "Histórico" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Seus lances (1)")).toBeVisible();
    await page.getByText("Seus lances (1)").click();
    await expect(page.getByText(/R\$ 100,00 · /)).toBeVisible();
  } finally {
    await seller.ctx.dispose();
  }
});
