import { expect, test, type Browser, type Page } from "@playwright/test";
import { apiAs, authFile, deposit, publishLot, type ApiSession, type Role } from "./support/api-session";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

let seller: ApiSession;

test.beforeAll(async () => {
  seller = await apiAs("auctioneer");
  for (const role of ["bidder", "bidder2"] as const) await deposit(await apiAs(role), "500000");
});

/** Login pela tela já é coberto em private-journeys; aqui a aba abre com a sessão salva. */
async function bidderPage(browser: Browser, role: Role, lotId: string): Promise<Page> {
  const page = await (await browser.newContext({ storageState: authFile(role) })).newPage();
  await markTourSeen(page);
  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByRole("button", { name: "Dar lance" })).toBeVisible();
  return page;
}

async function bid(page: Page, shortcut: string) {
  await page.getByRole("button", { name: shortcut, exact: true }).click();
  await page.getByRole("button", { name: "Dar lance" }).click();
  await page.getByRole("button", { name: "Confirmar lance" }).click();
}

test("duas abas: lance aparece na outra sem recarregar, superado vê aviso, auditoria íntegra", async ({ browser }) => {
  const lotId = await publishLot(seller, { endsInMs: 30 * 60_000 });
  const a = await bidderPage(browser, "bidder", lotId);
  const b = await bidderPage(browser, "bidder2", lotId);
  await expect(b.getByTestId("current-price")).toHaveText("R$ 100,00");

  await bid(a, "R$ 100,00");
  await expect(a.getByText("Lance confirmado. Você está ganhando.")).toBeVisible();
  await expect(b.getByText("Próximo lance mínimo R$ 110,00")).toBeVisible({ timeout: 8_000 });

  await bid(b, "R$ 120,00");
  await expect(b.getByText("Você está ganhando. Seu lance de R$ 120,00")).toBeVisible();
  await expect(a.getByTestId("current-price")).toHaveText("R$ 120,00", { timeout: 8_000 });
  await expect(a.getByText("Você foi superado. Seu lance de R$ 100,00 voltou para o disponível.")).toBeVisible({ timeout: 8_000 });

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/lotes/${lotId}`);
  await expect(visitor.getByRole("link", { name: "Entrar para dar lance" })).toBeVisible();
  await expect(visitor.getByText("e2e-licitante")).toHaveCount(0);
  await visitor.goto(`/lotes/${lotId}/auditoria`);
  await expect(visitor.getByText("Íntegro.")).toBeVisible();
});

test("lance na reta final prorroga, encerra, liquida e o vencedor abre comprovante público válido", async ({ browser }) => {
  test.setTimeout(240_000);
  const lotId = await publishLot(seller, { endsInMs: 20_000, externalId: "437329" });
  const a = await bidderPage(browser, "bidder", lotId);
  await expect(a.getByText("Reta final: lance agora prorroga para 2 min")).toBeVisible();
  await bid(a, "R$ 100,00");
  await expect(a.getByText("Lance confirmado. O prazo foi prorrogado.")).toBeVisible();

  await expect(a.getByText("Encerrado. Arrematado por R$ 100,00.")).toBeVisible({ timeout: 180_000 });
  const winner = await apiAs("bidder");
  const awards = (await (await winner.ctx.get("/api/me/awards?page=1")).json()) as { items: { lotId: string; receiptToken: string }[] };
  const token = awards.items.find((item) => item.lotId === lotId)?.receiptToken;
  expect(token).toBeTruthy();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/comprovantes/${token}`);
  await expect(visitor.getByRole("heading", { name: "Comprovante de arremate" })).toBeVisible();
  await expect(visitor.getByText("Simulação · sem valor fiscal ou de compra")).toBeVisible();
  await expect(visitor.getByText("R$ 100,00").first()).toBeVisible();
});
