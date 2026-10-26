import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser } from "@playwright/test";
import { apiAs, apiLoginFresh, authFile, deposit, publishLot } from "./support/api-session";
import { ensureE2eUsers } from "./support/demo-users";
import { markTourSeen } from "./support/tour";

/** Achados do QA (26/10): cada teste prova uma correção, no build de produção do E2E. */
const SHOTS = resolve(__dirname, "../../casadeleilao-runs/qa-fix-shots");
const MOBILE = { width: 390, height: 844 };

async function pageAs(browser: Browser, role: "bidder" | "bidder2", viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ storageState: authFile(role), viewport });
  const page = await context.newPage();
  await markTourSeen(page);
  return page;
}

test("carteira a 390px: sem rolagem lateral, barra e Pix clicáveis", async ({ browser }) => {
  const page = await pageAs(browser, "bidder", MOBILE);
  await page.goto("/carteira");
  await expect(page.getByTestId("saldo-total")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const bar = page.getByTestId("carteira-barra-deposito");
  await bar.getByRole("button", { name: "Adicionar saldo" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "R$ 1.000", exact: true }).click();
  await sheet.getByRole("button", { name: "Simular pagamento aprovado" }).click();
  await expect(page.getByText("Pagamento simulado aprovado. Saldo atualizado.").first()).toBeVisible();
  mkdirSync(SHOTS, { recursive: true });
  {
    await page.screenshot({ path: `${SHOTS}/carteira-390-depois.png`, fullPage: true });
  }
});

test("QA N2: a 390px o selo Simulado não cobre o X e a Sheet fecha por ele", async ({ browser }) => {
  const page = await pageAs(browser, "bidder", MOBILE);
  await page.goto("/carteira");
  await page.getByTestId("carteira-barra-deposito").getByRole("button", { name: "Adicionar saldo" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const close = sheet.getByRole("button", { name: "Fechar" });
  const badge = sheet.getByText("Simulado", { exact: true }).first();
  const [x, b] = [await close.boundingBox(), await badge.boundingBox()];
  expect(x && b).toBeTruthy();
  const overlaps = !!x && !!b && b.x < x.x + x.width && x.x < b.x + b.width && b.y < x.y + x.height && x.y < b.y + b.height;
  expect(overlaps).toBe(false);
  await close.click();
  await expect(sheet).toBeHidden();
});

test("depósito de R$ 0 mostra a mensagem na hora", async ({ browser }) => {
  const page = await pageAs(browser, "bidder");
  await page.goto("/carteira?aba=pix");
  await page.getByLabel(/Valor/).first().fill("0");
  await expect(page.getByText(/Digite um valor maior que zero/)).toBeVisible();
});

test("lance acima do saldo avisa e leva à carteira", async ({ browser }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const page = await pageAs(browser, "bidder");
  await page.goto(`/lotes/${lotId}`);
  await page.locator("form:has(button:has-text('Dar lance')) input").fill("90000000");
  await page.getByRole("button", { name: "Dar lance" }).click();
  const alert = page.getByTestId("saldo-insuficiente");
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("link", { name: "Adicionar saldo" })).toHaveAttribute("href", /\/carteira/);
});

test("lance superado gera aviso e toast para quem perdeu a liderança", async ({ browser }) => {
  test.setTimeout(90_000);
  const first = await apiAs("bidder");
  const second = await apiAs("bidder2");
  await deposit(first, "500000");
  await deposit(second, "500000");
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const page = await pageAs(browser, "bidder");
  await page.goto("/");
  await first.post(`/api/lots/${lotId}/bids`, { amountCents: "12000" });
  await second.post(`/api/lots/${lotId}/bids`, { amountCents: "15000" });
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Você foi superado" })).toBeVisible({ timeout: 45_000 }); // o sino consulta a cada 30 s
});

test("lote agendado oferece Avise-me na sala", async ({ browser }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { startsInMs: 60 * 60_000, endsInMs: 120 * 60_000 });
  const page = await pageAs(browser, "bidder");
  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByRole("button", { name: /Avise-me/ }).first()).toBeVisible();
});

test("logout troca o header para Entrar sem recarregar", async ({ browser }) => {
  // Sessão própria: o logout não pode derrubar a sessão compartilhada dos outros testes.
  const own = await apiLoginFresh((await ensureE2eUsers()).bidder2);
  const context = await browser.newContext({ storageState: await own.ctx.storageState() });
  const page = await context.newPage();
  await markTourSeen(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  // Sem reload: o menu some na hora e, saindo de /entrar pela navegação do app, o header oferece Entrar.
  await expect(page.getByRole("button", { name: "Menu da conta" })).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as { __semReload: boolean }).__semReload = true; });
  await page.getByRole("banner").getByRole("link").first().click();
  await expect(page.getByRole("banner").getByRole("button", { name: "Entrar" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __semReload?: boolean }).__semReload)).toBe(true);
});

test("abas do /suporte cabem em 390px", async ({ browser }) => {
  const context = await browser.newContext({ viewport: MOBILE });
  const page = await context.newPage();
  await markTourSeen(page);
  await page.goto("/suporte");
  const tabs = page.getByRole("tab");
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) {
    const box = await tabs.nth(i).boundingBox();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 999) <= 390).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
