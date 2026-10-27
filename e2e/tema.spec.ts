import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { apiAs, authFile, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

const SHOTS = resolve(__dirname, "../../casadeleilao-runs/tema-shots");

test("sem escolha segue o sistema; menu Claro, Escuro e Sistema, e a escolha sobrevive ao recarregar", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await markTourSeen(page);
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  const choose = async (name: string) => {
    await page.getByRole("button", { name: "Tema" }).click();
    await page.getByRole("menuitemradio", { name }).click();
  };

  await choose("Claro");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(246, 243, 236)");
  await page.getByRole("button", { name: "Tema" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Claro" })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await choose("Escuro");
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(21, 18, 14)");

  // Sistema: apaga a escolha e acompanha o sistema operacional, inclusive se ele mudar com a página aberta.
  await choose("Sistema");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("arremate:theme"))).toBeNull();
  await context.close();
});

test("telas principais no tema escuro, sem erro de console", async ({ browser }) => {
  mkdirSync(SHOTS, { recursive: true });
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000 });
  const context = await browser.newContext({ colorScheme: "dark", storageState: authFile("bidder"), viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await markTourSeen(page);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const [name, path] of [
    ["sala", `/lotes/${lotId}`],
    ["auditoria", `/lotes/${lotId}/auditoria`],
    ["carteira", "/carteira"],
    ["como-funciona", "/como-funciona"],
    ["vitrine", "/"], // por último: o splash só toca no primeiro acesso da sessão
  ] as const) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: name === "vitrine" });
  }
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/carteira");
    await page.screenshot({ path: resolve(SHOTS, `header-${width}.png`), clip: { x: 0, y: 0, width, height: 140 } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  expect(errors.filter((text) => /Content Security Policy|hydrat/i.test(text))).toEqual([]);
  await context.close();
});
