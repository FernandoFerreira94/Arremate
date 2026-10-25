import { expect, test, type Page } from "@playwright/test";
import { apiAs, authFile, deposit, publishLot } from "./support/api-session";

async function countNewEntries(page: Page) {
  await expect(page.locator("html")).not.toHaveAttribute("data-arremate-intro", "playing");
  await expect.poll(() => page.locator(".page-entrance").evaluate((root) =>
    root.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation && a.animationName.startsWith("entry-") && a.playState !== "finished" && a.playState !== "idle").length,
  )).toBe(0);
  await page.locator(".page-entrance").evaluate((root) => {
    root.setAttribute("data-new-entries", "0");
    root.addEventListener("animationstart", (event) => {
      if ((event as AnimationEvent).animationName.startsWith("entry-")) {
        root.setAttribute("data-new-entries", String(Number(root.getAttribute("data-new-entries")) + 1));
      }
    });
  });
}

test("splash é decidido antes do conteúdo e termina na primeira visita", async ({ page, request }) => {
  const response = await request.get("/");
  const html = await response.text();
  expect(html.includes('id="arremate-intro-boot"')).toBe(true);
  expect(html.indexOf('id="arremate-intro-boot"')).toBeLessThan(html.indexOf("<body"));
  await page.addInitScript(() => {
    const sample = () => {
      const cover = document.querySelector(".brand-intro");
      if (!cover) { requestAnimationFrame(sample); return; }
      const style = getComputedStyle(cover);
      const box = cover.getBoundingClientRect();
      document.documentElement.setAttribute("data-test-intro-first-frame", JSON.stringify({
        playing: document.documentElement.getAttribute("data-arremate-intro") === "playing",
        observedAt: performance.now(),
        visible: style.display !== "none" && Number(style.opacity) > 0,
        fullViewport: box.width >= innerWidth && box.height >= innerHeight,
        background: style.backgroundColor,
      }));
    };
    requestAnimationFrame(sample);
  });
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => hydrationErrors.push(error.message));
  page.on("console", (message) => { if (/hydration|did not match|server rendered|Minified React error/i.test(message.text())) hydrationErrors.push(message.text()); });
  await page.goto("/");
  const first = await page.locator("html").getAttribute("data-test-intro-first-frame");
  expect(first).not.toBeNull();
  expect(JSON.parse(first ?? "null")).toMatchObject({ playing: true, visible: true, fullViewport: true, background: "rgb(246, 243, 236)" });
  await expect(page.locator(".brand-intro")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("arremate:intro:v1"))).toBe("seen");
  await expect(page.locator("html")).not.toHaveAttribute("data-arremate-intro", "playing", { timeout: 6000 });
  const elapsed = await page.evaluate(() => performance.now()) - JSON.parse(first ?? "null").observedAt;
  expect(elapsed).toBeGreaterThanOrEqual(2500);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  await page.reload();
  await expect(page.locator(".brand-intro")).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-arremate-intro", "playing");
});

test("entrada acompanha a rota, sem repetir splash nem reiniciar a cada render do relógio", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-entrance")).toHaveAttribute("data-page-path", "/");
  await expect(page.locator("html")).not.toHaveAttribute("data-arremate-intro", "playing");
  await page.locator(".page-entrance").evaluate((root) => {
    root.setAttribute("data-entry-starts", "0");
    root.addEventListener("animationstart", () => {
      root.setAttribute("data-entry-starts", String(Number(root.getAttribute("data-entry-starts")) + 1));
    });
  });
  // useNow atualiza a vitrine a cada segundo; nenhuma entrada deve ser reiniciada.
  await page.waitForTimeout(1500);
  const starts = await page.locator(".page-entrance").getAttribute("data-entry-starts");
  await page.waitForTimeout(1100);
  await expect(page.locator(".page-entrance")).toHaveAttribute("data-entry-starts", starts ?? "0");
  // Rodada 3: "Entrar" virou Sheet (sem troca de rota); a navegação é conferida por um link real do cabeçalho.
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Como funciona", exact: true }).click();
  await expect(page.locator(".page-entrance")).toHaveAttribute("data-page-path", "/como-funciona");
  await expect(page.locator(".brand-intro")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Como funciona a demonstração" })).toBeVisible();
});

test("movimento reduzido omite splash e animações de entrada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".brand-intro")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const animation = await page.locator(".page-entrance > div > div").first().evaluate((node) => getComputedStyle(node).animationName);
  expect(animation).toBe("none");
});

test("storage indisponível não esconde conteúdo nem repete uma introdução", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage indisponível"); } });
  });
  await page.goto("/");
  await expect(page.locator(".brand-intro")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("teclado cancela introdução e mantém o foco acessível", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  await page.getByRole("link", { name: "Pular para o conteúdo" }).waitFor({ state: "attached" });
  await page.keyboard.press("Tab");
  await expect(page.locator("html")).not.toHaveAttribute("data-arremate-intro", "playing");
  await expect(page.locator(".brand-intro")).toBeHidden();
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeVisible();
});

test("sem JavaScript a introdução não cobre o shell renderizado no servidor", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".brand-intro")).toBeHidden();
    // A vitrine usa useSearchParams/Suspense e requer JS; o shell SSR permanece acessível.
    await expect(page.getByRole("link", { name: "Arremate, página inicial" })).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  } finally {
    await context.close();
  }
});



test("preço ao vivo e saldo confirmado mudam sem reiniciar montagem", async ({ browser, baseURL }) => {
  test.setTimeout(60000);
  const seller = await apiAs("auctioneer");
  const first = await apiAs("bidder");
  const second = await apiAs("bidder2");
  const context = await browser.newContext({ storageState: authFile("bidder"), baseURL });
  try {
    await deposit(first, "500000");
    await deposit(second, "500000");
    const lotId = await publishLot(seller, { endsInMs: 30 * 60_000 });
    const page = await context.newPage();
    await page.goto(`/lotes/${lotId}`);
    await expect(page.getByTestId("current-price")).toHaveText("R$ 100,00");
    await countNewEntries(page);
    await second.post(`/api/lots/${lotId}/bids`, { amountCents: "12000" });
    await expect(page.getByTestId("current-price")).toHaveText("R$ 120,00", { timeout: 10000 });
    await expect(page.locator(".page-entrance")).toHaveAttribute("data-new-entries", "0");

    await page.goto("/carteira");
    const total = page.getByTestId("saldo-total");
    await expect(total).toBeVisible();
    const before = await total.textContent();
    await countNewEntries(page);
    await page.getByRole("button", { name: "R$ 1.000", exact: true }).click();
    await page.getByRole("button", { name: "Adicionar saldo", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar depósito", exact: true }).click();
    await expect(page.getByText("Depósito de R$ 1.000,00 confirmado.")).toBeVisible();
    await expect(total).not.toHaveText(before ?? "");
    await expect(page.locator(".page-entrance")).toHaveAttribute("data-new-entries", "0");

    await page.setViewportSize({ width: 390, height: 844 });
    const fixed = page.locator(".fixed.inset-x-0.bottom-0");
    await expect(fixed).toBeVisible();
    const box = await fixed.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThan(2);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".brand-intro")).toBeHidden();
  } finally {
    await context.close();
    await seller.ctx.dispose();
    await first.ctx.dispose();
    await second.ctx.dispose();
  }
});
