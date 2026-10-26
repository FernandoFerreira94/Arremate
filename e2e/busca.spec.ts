import { expect, test } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

test("busca no header acha o lote pelo nome da obra, mantém a aba e limpa", async ({ page }) => {
  const seller = await apiAs("auctioneer");
  const lotId = await publishLot(seller, { endsInMs: 30 * 60_000 });
  const lot = (await (await seller.ctx.get(`/api/lots/${lotId}`)).json()) as { title: string };
  const term = lot.title.split(/\s+/).find((word) => word.length >= 4) ?? lot.title;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?aba=ao-vivo");
  const header = page.locator("header");
  await header.getByRole("searchbox", { name: "Buscar obra ou artista" }).fill(term);
  await header.getByRole("searchbox", { name: "Buscar obra ou artista" }).press("Enter");

  await expect(page).toHaveURL(/aba=ao-vivo/);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term).replace(/%20/g, "\\+")}`));
  await expect(page.getByText(`Resultados para “${term}”`)).toBeVisible();
  await expect(page.locator(`a[href="/lotes/${lotId}"]`)).toBeVisible();

  await header.getByRole("searchbox", { name: "Buscar obra ou artista" }).fill("zzz-obra-que-nao-existe");
  await header.getByRole("searchbox", { name: "Buscar obra ou artista" }).press("Enter");
  await expect(page.getByText(/Nada encontrado para "zzz-obra-que-nao-existe"/)).toBeVisible();

  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(header.getByRole("searchbox", { name: "Buscar obra ou artista" })).toHaveValue("");
});

test("a 390px a busca fica na vitrine e no menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("header").getByRole("searchbox")).toBeHidden();
  const inPage = page.locator("main").getByRole("searchbox", { name: "Buscar obra ou artista" });
  await expect(inPage).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const inMenu = page.getByRole("dialog").getByRole("searchbox", { name: "Buscar obra ou artista" });
  await inMenu.fill("retrato");
  await inMenu.press("Enter");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/q=retrato/);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
