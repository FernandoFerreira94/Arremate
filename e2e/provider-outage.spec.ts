import { expect, test } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

/**
 * O navegador nunca fala com o The Met: imagem e ficha vêm do snapshot local.
 * A queda do provider no lado da API é coberta em back-end/test/integration (Tarefa 4).
 */
test("com o The Met inacessível, vitrine, sala e imagem continuam vindo do snapshot", async ({ page }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000, externalId: "437329" }); // snapshot com imagem real no banco de teste
  const external: string[] = [];
  await page.route(/metmuseum\.org/, (route) => {
    external.push(route.request().url());
    return route.abort("internetdisconnected");
  });

  await page.goto(`/lotes/${lotId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Sobre o lote")).toBeVisible();
  const image = page.locator("figure img");
  await expect(image).toHaveAttribute("src", /^\/api\/media\//);
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByText(/The Met|Metropolitan/).first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /./ }).filter({ has: page.locator(`[href="/lotes/${lotId}"]`) }).or(page.locator(`a[href="/lotes/${lotId}"]`)).first()).toBeVisible();
  expect(external).toEqual([]);
});
