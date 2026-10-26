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
    // há duas versões (nome escuro e nome em papel); o tema decide qual aparece
    const logo = home.locator("img:visible");
    await expect(logo).toHaveAttribute("src", /l3-horizontal-paper\.svg/);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const box = await logo.boundingBox();
    expect(box?.height).toBeCloseTo(32, 0);
  });
}

test("no tema escuro o header usa a logo com o nome em papel", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const logo = page.getByRole("banner").getByRole("link", { name: "Arremate, página inicial" }).locator("img:visible");
  await expect(logo).toHaveAttribute("src", /l3-horizontal-noite\.svg/);
});

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

test("splash de entrada mostra o martelo da L3, sem a letra A", async ({ page }) => {
  await page.goto("/entrar");
  const mark = page.locator(".brand-intro__mark");
  await expect(mark.locator("svg.brand-intro__glyph")).toHaveCount(1);
  expect((await mark.textContent())?.trim()).toBe("");
  await expect(page.locator(".brand-intro__letter")).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`tela de entrar mostra a logo L3 em ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/entrar");
    const logo = page.getByRole("banner").getByRole("link", { name: "Arremate, página inicial" }).locator("img:visible");
    await expect(logo).toHaveAttribute("src", /l3-horizontal-paper\.svg/);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  });
}

test("imagem de compartilhamento da vitrine é gerada com a L3", async ({ request }) => {
  const response = await request.get("/opengraph-image");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
