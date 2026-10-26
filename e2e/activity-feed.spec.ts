import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Browser } from "@playwright/test";
import { apiAs, authFile, deposit, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D32: feed de lances ao vivo de outras pessoas no canto inferior direito. */
const SHOTS = resolve(__dirname, "../../casadeleilao-runs/activity-feed-shots");

async function bidderPage(browser: Browser, viewport: { width: number; height: number }, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  const context = await browser.newContext({ storageState: authFile("bidder"), viewport, reducedMotion });
  const page = await context.newPage();
  await markTourSeen(page);
  return page;
}

async function lotWithTitle(): Promise<{ lotId: string; title: string }> {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const detail = (await (await (await apiAs("bidder")).ctx.get(`/api/lots/${lotId}`)).json()) as { title: string };
  return { lotId, title: detail.title };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`lance de outra pessoa sobe no feed com o nome da obra e abre o valor (${viewport.width}px)`, async ({ browser }) => {
    const other = await apiAs("bidder2");
    await deposit(other, "500000");
    const { lotId, title } = await lotWithTitle();
    const page = await bidderPage(browser, viewport);
    await page.goto("/");
    const feed = page.getByTestId("activity-feed");
    await expect(feed).toBeAttached();
    await page.waitForTimeout(1500); // o primeiro polling marca o cursor; o lance vem depois
    await other.post(`/api/lots/${lotId}/bids`, { amountCents: "10000" });
    const card = feed.getByTestId("activity-card").filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("R$ 100,00")).toBeVisible();
    await expect(card.getByRole("link", { name: "Ver lote" })).toHaveAttribute("href", `/lotes/${lotId}`);
    await expect(feed.locator("[aria-live='polite']")).toContainText(title);
    const box = await card.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(viewport.width);
    mkdirSync(SHOTS, { recursive: true });
    // Accordion aberto por completo antes do print.
    await expect.poll(() => card.locator(".feed-card__details").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await page.screenshot({ path: resolve(SHOTS, `feed-${viewport.width}.png`) });
    await card.getByRole("button", { name: /Fechar aviso/ }).click();
    await expect(card).toHaveCount(0);
    await page.context().close();
  });
}

test("o próprio lance não aparece no feed, nem lance do lote cuja sala está aberta", async ({ browser }) => {
  const me = await apiAs("bidder");
  const other = await apiAs("bidder2");
  await deposit(me, "500000");
  await deposit(other, "500000");
  const own = await lotWithTitle();
  const room = await lotWithTitle();
  const page = await bidderPage(browser, { width: 1440, height: 900 });
  await page.goto(`/lotes/${room.lotId}`);
  await page.waitForTimeout(1500);
  await me.post(`/api/lots/${own.lotId}/bids`, { amountCents: "10000" });
  await other.post(`/api/lots/${room.lotId}/bids`, { amountCents: "10000" });
  await page.waitForTimeout(9_000); // dois pollings
  await expect(page.getByTestId("activity-card")).toHaveCount(0);
  await page.context().close();
});

test("com movimento reduzido o card aparece pronto, sem animação", async ({ browser }) => {
  const other = await apiAs("bidder2");
  await deposit(other, "500000");
  const { lotId, title } = await lotWithTitle();
  const page = await bidderPage(browser, { width: 1440, height: 900 }, "reduce");
  await page.goto("/");
  await page.waitForTimeout(1500);
  await other.post(`/api/lots/${lotId}/bids`, { amountCents: "10000" });
  const card = page.getByTestId("activity-card").filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 15_000 });
  expect(await card.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(card.getByText("R$ 100,00")).toBeVisible();
  await page.context().close();
});
