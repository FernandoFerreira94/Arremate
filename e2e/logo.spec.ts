import { expect, test } from "@playwright/test";
import { markTourSeen } from "./support/tour";

/** Logo L3 (martelo) no header e no footer, desktop e celular, e os links de ícone no head. */
test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`header mostra a logo L3 em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const home = page.getByRole("banner").getByRole("link", { name: "Arremate, página inicial" });
    await expect(home).toBeVisible();
    const logo = home.locator("img");
    await expect(logo).toHaveAttribute("src", /l3-horizontal-paper\.svg/);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const box = await logo.boundingBox();
    expect(box?.height).toBeCloseTo(32, 0);
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`footer mostra a logo L3 na variante bordô em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const home = page.getByRole("contentinfo").getByRole("link", { name: "Arremate, voltar à vitrine" });
    await home.scrollIntoViewIfNeeded();
    await expect(home).toBeVisible();
    const logo = home.locator("img");
    await expect(logo).toHaveAttribute("src", /l3-horizontal-bordo\.svg/);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect((await logo.boundingBox())?.height).toBeCloseTo(32, 0);
  });
}

test("head aponta favicon, ícone e apple-touch da L3", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="icon"][href*="favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href*="icon.svg"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"][href*="apple-icon.png"]')).toHaveCount(1);
});
