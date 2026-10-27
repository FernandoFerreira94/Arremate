import { expect, test } from "@playwright/test";
import { apiAs, authFile, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** Code review item 4: painel do leiloeiro em 390 px com cards, sem rolagem lateral, e abas contadas no servidor. */
test("painel do leiloeiro no celular: cards, abas com totais do servidor e paginação de 10", async ({ browser }) => {
  const seller = await apiAs("auctioneer");
  await publishLot(seller, { endsInMs: 30 * 60_000 });
  const { counts } = (await (await seller.ctx.get("/api/seller/lots")).json()) as { counts: Record<string, number> };

  const context = await browser.newContext({ storageState: authFile("auctioneer"), viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await markTourSeen(page);
  await page.goto("/painel/lotes");
  await expect(page.getByRole("tab", { name: new RegExp(`Todos\\s*${counts.all}`) })).toBeVisible();
  const cards = page.getByRole("list", { name: "Lotes" }).getByRole("listitem");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if ((counts.all ?? 0) > 10) await expect(page.getByRole("navigation", { name: "Paginação dos lotes" })).toBeVisible();

  await page.getByRole("tab", { name: /Ao vivo/ }).click();
  await expect(cards.first()).toContainText("Ao vivo");
  await context.close();
});
