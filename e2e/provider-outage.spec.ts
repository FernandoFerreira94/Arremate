import { expect, test } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { E2E_BASE } from "./support/e2e-env";
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
  await expect(image).toHaveAttribute("src", /\/_next\/image\?/);
  const optimized = new URL((await image.getAttribute("src")) ?? "", E2E_BASE);
  expect(optimized.origin).toBe(E2E_BASE);
  expect(optimized.pathname).toBe("/_next/image");
  expect(optimized.searchParams.get("url")).toMatch(/^\/api\/media\/[a-f0-9]{64}\.(jpg|png|webp)$/);
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByText(/The Met|Metropolitan/).first()).toBeVisible();

  // A vitrine pagina todos os lotes pelo término; na suíte completa os specs anteriores empurram este para outra página.
  let showcasePage = 1;
  for (; showcasePage <= 50; showcasePage += 1) {
    const res = await page.request.get(`/api/lots?page=${showcasePage}`);
    const body = (await res.json()) as { items: { id: string }[] };
    if (body.items.some((lot) => lot.id === lotId) || body.items.length === 0) break;
  }
  await page.goto(`/?page=${showcasePage}`);
  await expect(page.getByRole("link", { name: /./ }).filter({ has: page.locator(`[href="/lotes/${lotId}"]`) }).or(page.locator(`a[href="/lotes/${lotId}"]`)).first()).toBeVisible();
  expect(external).toEqual([]);
});
