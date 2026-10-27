import { expect, test } from "@playwright/test";
import { markTourSeen } from "./support/tour";

/** PWA: manifesto instalável, ícones, service worker registrado e página offline sem dados antigos. */
test("PWA: manifesto, ícones e service worker; sem rede mostra a página offline", async ({ page, context }) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const body = (await manifest.json()) as { name: string; display: string; start_url: string; icons: { src: string; sizes: string; purpose?: string }[] };
  expect(body).toMatchObject({ display: "standalone", start_url: "/" });
  expect(body.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(body.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of body.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  const sw = await page.request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");

  await markTourSeen(page);
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/");
  // Garante que o worker já controla a página antes de cortar a rede.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.goto("/como-funciona").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("heading", { name: "Leilões de arte de acervo público" })).toBeVisible();
});

test("header mostra o ícone discreto de instalar quando o navegador oferece, com cartão de contexto", async ({ page }) => {
  await markTourSeen(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const install = page.locator("header").getByRole("button", { name: "Instalar o app Arremate" });
  await expect(install).toHaveCount(0);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt?: () => Promise<void>; userChoice?: Promise<unknown> };
    event.prompt = async () => undefined;
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
  await expect(install).toBeVisible();
  await install.hover();
  await expect(page.getByRole("tooltip")).toContainText("Instalar o Arremate");
  await install.click();
  await expect(install).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Instalar o app" })).toHaveCount(0);
});

test("cartão de contexto no hover e no foco do teclado (tema)", async ({ page }) => {
  await markTourSeen(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const theme = page.getByRole("button", { name: "Tema" });
  await theme.hover();
  await expect(page.getByRole("tooltip")).toContainText("Claro, escuro ou igual ao sistema");
  // Movimento real do mouse (vários eventos), como a pessoa faz ao sair do botão.
  await page.mouse.move(0, 400, { steps: 8 });
  await page.mouse.move(5, 420);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await theme.focus();
  await expect(page.getByRole("tooltip")).toContainText("Tema");
});
