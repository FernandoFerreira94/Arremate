import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { apiAs, authFile, publishLot } from "./support/api-session";

test.use({ reducedMotion: "reduce" });

test("faixa e links informativos funcionam em desktop e mobile", async ({ page }) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const banner = page.getByTestId("demo-banner");
    await expect(banner).toContainText("pagamentos simulados");
    if (width !== 320) await page.screenshot({ path: "docs/evidence/screenshots/auth-pagamentos-etapa-1/faixa-" + width + ".png", fullPage: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(banner).toBeInViewport();
    for (const [name, title] of [["Termos de uso", "Termos de uso"], ["Privacidade", "Privacidade"], ["Como funciona a demonstração", "Como funciona a demonstração"]]) {
      const footerLink = page.getByRole("contentinfo").getByRole("link", { name, exact: true });
      expect((await footerLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await footerLink.click();
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(banner).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test("imagem local é otimizada; erro mostra fallback sem bloquear a sala", async ({ page }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  await page.goto("/lotes/" + lotId);
  const image = page.locator("main figure img").first();
  await expect(image).toHaveAttribute("src", /\/_next\/image\?/);
  await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height:900});
    await expect(image).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path:"docs/evidence/screenshots/auth-pagamentos-etapa-1/sala-" + width + ".png", fullPage:true});
  }
  await page.route("**/_next/image?**", (route) => route.abort());
  await page.reload();
  await expect(page.getByText("Imagem indisponível", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar para dar lance" })).toBeVisible();
});

test("preview do lote é PNG1200x630 e não contém dados financeiros no head", async ({ request }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const page = await request.get("/lotes/" + lotId, { headers: { "User-Agent": "Twitterbot" } });
  const html = await page.text();
  const head = html.split("</head>")[0];
  expect(head).toContain("/lotes/" + lotId + "/opengraph-image");
  expect(head).not.toMatch(/currentCents|availableCents|@arremate\.test/);
  const image = await request.get("/lotes/" + lotId + "/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
  const proofDir = resolve(__dirname, "../docs/evidence/screenshots/auth-pagamentos-etapa-1");
  mkdirSync(proofDir, {recursive:true});
  writeFileSync(resolve(proofDir, "og-lote.png"), bytes);
});


test("lote ausente mantém HTTP404 para navegador e crawler", async ({ request }) => {
  for (const agent of ["Mozilla/5.0", "Twitterbot"]) {
    for (const path of ["/lotes/00000000-0000-4000-8000-000000000000", "/lotes/nao-e-uuid", "/lotes/00000000-0000-4000-8000-000000000000/auditoria", "/comprovantes/curto"]) {
      const response = await request.get(path, { headers: { "User-Agent": agent } });
      expect(response.status(), agent + " " + path).toBe(404);
      expect(await response.text()).toContain(path.startsWith("/comprovantes/") ? "Comprovante não encontrado" : "Lote não encontrado");
    }
  }
});


test("prévia tenta novamente a imagem ao selecionar A, B e voltar a A", async ({ browser }) => {
  const context = await browser.newContext({ storageState: authFile("auctioneer"), reducedMotion: "reduce" });
  const page = await context.newPage();
  const imageA = "/api/media/" + "a".repeat(64) + ".png";
  const imageB = "/api/media/" + "b".repeat(64) + ".png";
  const pixel = readFileSync(resolve(__dirname, "../docs/design/pranchas/assets/meta/apple-touch-icon.png"));
  let allowA = false;
  await page.route("**/api/catalog/search?**", (route) => route.fulfill({ json: { items: [
    { externalId: "1", title: "Obra A", artist: "Artista A", date: "1900", medium: "Pintura", credit: "The Met", sourceUrl: null, thumbnailUrl: imageA, importable: true },
    { externalId: "2", title: "Obra B", artist: "Artista B", date: "1901", medium: "Pintura", credit: "The Met", sourceUrl: null, thumbnailUrl: imageB, importable: true },
  ], page: 1, pageSize: 8, total: 2, hasMore: false } }));
  await page.route("**/_next/image?**", (route) => {
    const source = new URL(route.request().url()).searchParams.get("url");
    if (source === imageA && !allowA) return route.abort();
    return route.fulfill({ contentType: "image/png", body: pixel });
  });
  try {
    await page.goto("/painel/lotes/novo");
    await page.getByRole("textbox", { name: "Buscar obra", exact: true }).fill("arte");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    const itemA = page.getByRole("listitem").filter({ hasText: "Obra A" });
    const itemB = page.getByRole("listitem").filter({ hasText: "Obra B" });
    const preview = page.locator('[data-slot="card"]').filter({ has: page.getByText("Obra selecionada", { exact: true }) });
    await itemA.getByRole("button", { name: "Selecionar", exact: true }).click();
    await expect(preview.getByText("Imagem indisponível", { exact: true })).toBeVisible();
    await itemB.getByRole("button", { name: "Selecionar", exact: true }).click();
    await expect(preview.getByRole("img", { name: "Obra B", exact: true })).toBeVisible();
    await preview.getByRole("img", { name: "Obra B", exact: true }).scrollIntoViewIfNeeded();
    allowA = true;
    await itemA.getByRole("button", { name: "Selecionar", exact: true }).click();
    const recovered = preview.getByRole("img", { name: "Obra A", exact: true });
    await expect(recovered).toBeVisible();
    await recovered.scrollIntoViewIfNeeded();
    await expect.poll(() => recovered.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally { await context.close(); }
});
