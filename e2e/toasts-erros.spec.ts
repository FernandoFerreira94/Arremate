import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { apiAs, authFile, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D25: toasts (Sonner), código para suporte, Desfazer do favorito e tela de erro, em desktop e mobile. */
const SHOTS = resolve(__dirname, "../../casadeleilao-runs/toast-shots");
mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

async function bidderPage(browser: Browser, viewport: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ storageState: authFile("bidder"), viewport });
  const page = await context.newPage();
  await markTourSeen(page);
  return page;
}

/**
 * Tela de erro sem rota de teste: o build de produção é o mesmo do usuário, e a API "devolve" um corpo
 * inesperado para o lote (null). A sala quebra na renderização e o error.tsx assume, como num erro real.
 */
async function breakLotRoom(page: Page): Promise<string> {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  await page.route(new RegExp(`/api/lots/${lotId}$`), (route) => route.fulfill({ status: 200, contentType: "application/json", body: "null" }));
  await page.goto(`/lotes/${lotId}`);
  return lotId;
}

const toasts = (page: Page) => page.locator("[data-sonner-toast]");

for (const { name, viewport } of VIEWPORTS) {
  test(`toast de sucesso com a mensagem da API (${name})`, async ({ browser }) => {
    const page = await bidderPage(browser, viewport);
    await page.goto("/carteira?aba=pix");
    await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
    await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
    const toast = toasts(page).filter({ hasText: "Depósito de R$ 1.000,00 adicionado à carteira." });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("data-type", "success");
    const box = await toast.boundingBox();
    if (name === "mobile") expect(box?.y ?? 999).toBeLessThan(300);
    else expect(box?.y ?? 0).toBeGreaterThan(viewport.height / 2);
    await page.screenshot({ path: resolve(SHOTS, `sucesso-${name}.png`) });
    await page.context().close();
  });

  test(`toast de erro com código para suporte e Tentar de novo (${name})`, async ({ browser }) => {
    const page = await bidderPage(browser, viewport);
    let calls = 0;
    await page.route("**/api/wallet/deposits", async (route) => {
      calls += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ statusCode: 500, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "3f9c2a71-e2e0-4d25-9b1a-7c0d5e8f1a42" }) });
    });
    await page.goto("/carteira?aba=pix");
    await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
    await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
    const toast = toasts(page).filter({ hasText: "Não foi possível concluir a operação." });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("data-type", "error");
    await expect(toast.getByTestId("support-code")).toHaveText("3f9c2a71-e2e0-4d25-9b1a-7c0d5e8f1a42");
    await expect(toast.getByRole("button", { name: "Copiar" })).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, `erro-${name}.png`) });
    // Com ação: fica até fechar (não some em 8 s).
    await page.waitForTimeout(8_500);
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Tentar de novo" }).click();
    await expect.poll(() => calls).toBe(2);
    await page.context().close();
  });

  test(`tela de erro inesperado no build de produção, sem rota de teste (${name})`, async ({ browser }) => {
    const page = await bidderPage(browser, viewport);
    await breakLotRoom(page);
    await expect(page.getByRole("heading", { name: "Algo deu errado" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar à vitrine", exact: true })).toBeVisible();
    await page.screenshot({ path: resolve(SHOTS, `tela-erro-${name}.png`), fullPage: name === "mobile" });
    await page.context().close();
  });
}

test("remover favorito mostra Desfazer, que refaz o favorito", async ({ browser }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const page = await bidderPage(browser, { width: 1440, height: 900 });
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: /^Favoritar/ }).first().click();
  await expect(toasts(page).filter({ hasText: "Adicionado aos favoritos." })).toBeVisible();
  await page.getByRole("button", { name: /Remover .* dos favoritos/ }).first().click();
  const removed = toasts(page).filter({ hasText: "Removido dos favoritos." });
  await expect(removed).toBeVisible();
  await removed.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: /Remover .* dos favoritos/ }).first()).toHaveAttribute("aria-pressed", "true");
  const favorites = (await (await page.request.get("/api/me/favorites")).json()) as { lotIds: string[] };
  expect(favorites.lotIds).toContain(lotId);
  await page.context().close();
});

test("dois avisos seguidos empilham em coluna: o novo embaixo, longe do feed de lances", async ({ browser }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const viewport = { width: 1440, height: 900 };
  const page = await bidderPage(browser, viewport);
  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: /^Favoritar/ }).first().click();
  const older = toasts(page).filter({ hasText: "Adicionado aos favoritos." });
  await expect(older).toBeVisible();
  await page.getByRole("button", { name: /Remover .* dos favoritos/ }).first().click();
  const newer = toasts(page).filter({ hasText: "Removido dos favoritos." });
  await expect(newer).toBeVisible();
  await expect(older).toBeVisible();
  // Coluna aberta: sem sobreposição, o mais novo embaixo e o anterior empurrado para cima, no canto esquerdo.
  await expect.poll(async () => {
    const [a, b] = [await older.boundingBox(), await newer.boundingBox()];
    return a && b ? a.y + a.height <= b.y : false;
  }).toBe(true);
  expect((await newer.boundingBox())?.x ?? viewport.width).toBeLessThan(viewport.width / 2);
  await page.screenshot({ path: resolve(SHOTS, "coluna-desktop.png") });
  await page.context().close();
});

test("o mesmo aviso repetido renova o toast aberto em vez de duplicar", async ({ browser }) => {
  const page = await bidderPage(browser, { width: 1440, height: 900 });
  await page.goto("/carteira?aba=pix");
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
    await page.getByRole("button", { name: "Simular pagamento aprovado" }).click();
    await expect(toasts(page).filter({ hasText: "Depósito de R$ 1.000,00 adicionado à carteira." })).toBeVisible();
  }
  await expect(toasts(page).filter({ hasText: "Depósito de R$ 1.000,00 adicionado à carteira." })).toHaveCount(1);
  await page.context().close();
});

test("relato de erro do navegador chega à API (202) quando a tela de erro aparece", async ({ page }) => {
  const reported = page.waitForRequest((request) => request.url().endsWith("/api/client-errors") && request.method() === "POST");
  await markTourSeen(page);
  await breakLotRoom(page);
  await expect(page.getByRole("heading", { name: "Algo deu errado" })).toBeVisible();
  const response = await (await reported).response();
  expect(response?.status()).toBe(202);
  expect((await page.request.get("/teste-erro")).status()).toBe(404);
});
