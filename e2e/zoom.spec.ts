import { expect, test, type Page } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D28 (Z3): zoom da obra no Dialog — desktop (clique, barra, teclado, arrastar, minimapa, erro) e celular (tela cheia, duplo toque, pinça). */
const EXTERNAL_ID = "437329";
let lotId: string;

test.beforeAll(async () => {
  lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000, externalId: EXTERNAL_ID });
});

async function openZoom(page: Page) {
  await markTourSeen(page);
  await page.goto(`/lotes/${lotId}`);
  const trigger = page.getByRole("button", { name: /^Ampliar imagem:/ });
  const hires = page.waitForResponse((r) => r.url().includes(`/api/media/zoom/${EXTERNAL_ID}`));
  await trigger.click();
  expect((await hires).status()).toBe(200);
  const dialog = page.getByTestId("zoom-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("zoom-placeholder")).toHaveCount(0);
  return { trigger, dialog, viewport: dialog.getByTestId("zoom-viewport"), level: dialog.getByTestId("zoom-level") };
}

const translateX = (page: Page) =>
  page.getByTestId("zoom-viewport").locator("> div").first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("lupa: o cursor amplia a obra em alta resolução onde passa; clique troca para o zoom de 2×", async ({ page }) => {
    const { viewport, level } = await openZoom(page);
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const lens = page.getByTestId("zoom-lens");
    await expect(lens).toBeVisible();
    expect(Number(await lens.getAttribute("data-factor"))).toBeGreaterThanOrEqual(2);
    expect(await lens.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(`/api/media/zoom/${EXTERNAL_ID}`);
    const before = await lens.evaluate((el) => getComputedStyle(el).backgroundPosition);
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
    await expect.poll(() => lens.evaluate((el) => getComputedStyle(el).backgroundPosition)).not.toBe(before);
    await page.mouse.down();
    await page.mouse.up();
    await expect(level).toHaveText("200%");
    await expect(lens).toHaveCount(0);
    await page.mouse.move(box.x + 2, box.y + 2);
    await page.mouse.move(box.x - 20, box.y - 20);
    await expect(lens).toHaveCount(0);
  });

  test("clique 1×→2×→3×→1×, minimapa, barra, teclado, arrastar e Esc devolve o foco", async ({ page }) => {
    const { trigger, dialog, viewport, level } = await openZoom(page);
    await expect(viewport).toBeFocused();
    await expect(level).toHaveText("100%");
    await expect(dialog.getByTestId("zoom-minimap")).toHaveCount(0);

    await viewport.click();
    await expect(level).toHaveText("200%");
    await expect(dialog.getByTestId("zoom-minimap")).toBeVisible();
    await viewport.click();
    await expect(level).toHaveText("300%");
    await expect(dialog.getByRole("button", { name: "Aumentar zoom" })).toBeDisabled();
    await viewport.click();
    await expect(level).toHaveText("100%");

    await dialog.getByRole("button", { name: "Aumentar zoom" }).click();
    await expect(level).toHaveText("150%");
    await dialog.getByRole("button", { name: "Diminuir zoom" }).click();
    await expect(level).toHaveText("100%");

    await viewport.focus();
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await expect(level).toHaveText("200%");
    await page.waitForTimeout(250);
    const before = await translateX(page);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => translateX(page)).toBeLessThan(before);
    await page.keyboard.press("-");
    await expect(level).toHaveText("150%");
    await page.keyboard.press("0");
    await expect(level).toHaveText("100%");

    // Arrastar a 2× move a obra sem mudar o nível.
    await viewport.click();
    await expect(level).toHaveText("200%");
    await page.waitForTimeout(250);
    const box = (await viewport.boundingBox())!;
    const start = await translateX(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(level).toHaveText("200%");
    await expect.poll(() => translateX(page)).toBeGreaterThan(start + 100);

    await dialog.getByRole("button", { name: "Redefinir zoom" }).click();
    await expect(level).toHaveText("100%");

    // Foco preso no dialog: Tab não sai dele.
    for (let i = 0; i < 8; i += 1) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("erro na imagem em alta mostra Tentar de novo e recupera", async ({ page }) => {
    let failures = 1;
    await page.route(/\/api\/media\/zoom\//, (route) => (failures-- > 0 ? route.abort("failed") : route.continue()));
    await markTourSeen(page);
    await page.goto(`/lotes/${lotId}`);
    await page.getByRole("button", { name: /^Ampliar imagem:/ }).click();
    const dialog = page.getByTestId("zoom-dialog");
    await expect(dialog.getByText("Não foi possível carregar a imagem em alta.")).toBeVisible();
    await dialog.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(dialog.getByTestId("zoom-hires")).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
  });

  test("com reduced-motion o zoom não anima", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      const { viewport } = await openZoom(page);
      const duration = await viewport.locator("> div").first().evaluate((el) => getComputedStyle(el).transitionDuration);
      expect(parseFloat(duration)).toBeLessThan(0.001); // reduced-motion global: 0s ou 0.01ms
    } finally {
      await context.close();
    }
  });
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("tela cheia, duplo toque 1×↔2,5×, pinça até 4× e Fechar na barra", async ({ page }) => {
    const { trigger, dialog, viewport, level } = await openZoom(page);
    const full = (await dialog.boundingBox())!;
    expect(full.width).toBeGreaterThanOrEqual(389);
    expect(full.height).toBeGreaterThanOrEqual(800);

    const box = (await viewport.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect(level).toHaveText("250%");
    await page.touchscreen.tap(cx, cy);
    await page.touchscreen.tap(cx, cy);
    await expect(level).toHaveText("100%");

    // Pinça com dois dedos (CDP): afastar de 60 px para 300 px dá 4× (teto do toque).
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", d: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }],
      });
    await touch("touchStart", 60);
    for (const d of [100, 160, 220, 300]) await touch("touchMove", d);
    await touch("touchEnd", 0);
    await expect(level).toHaveText("400%");
    await expect(dialog.getByTestId("zoom-minimap")).toBeVisible();

    await dialog.getByRole("button", { name: "Fechar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
