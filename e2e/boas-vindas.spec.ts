import { expect, test, type Browser } from "@playwright/test";
import { authFile } from "./support/api-session";
import { WELCOME_KEY } from "./support/welcome";

const TITLE = /Conheça o Arremate/;

/** Primeira visita de verdade: contexto sem o storageState do `use` (que marca o card como visto). */
async function firstVisit(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  const card = page.getByRole("dialog", { name: TITLE });
  // A introdução da marca (3 s) termina antes de o card abrir.
  await expect(card).toBeVisible({ timeout: 10_000 });
  return { page, card };
}

test("primeira visita abre o card com foco em Assistir; Esc dispensa, lembra e não volta", async ({ browser }) => {
  const { page, card } = await firstVisit(browser);
  await expect(card.getByRole("button", { name: "Assistir", exact: true })).toBeFocused();
  await expect(card.locator("video")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), WELCOME_KEY)).toBe("dismissed");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});

test("Assistir mostra o vídeo com controles (sem autoplay antes do clique) e Agora não fecha", async ({ browser }) => {
  const { page, card } = await firstVisit(browser);
  await card.getByRole("button", { name: "Assistir", exact: true }).click();
  const video = card.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("src", "/media/boas-vindas.mp4");
  expect(await page.evaluate((key) => localStorage.getItem(key), WELCOME_KEY)).toBe("watched");
  await card.getByRole("button", { name: "Fechar", exact: true }).first().click();
  await expect(card).toBeHidden();

  const other = await (await browser.newContext()).newPage();
  await other.goto("/");
  await expect(other.getByRole("dialog", { name: TITLE })).toBeVisible({ timeout: 10_000 });
  await other.getByRole("button", { name: "Agora não", exact: true }).click();
  await expect(other.getByRole("dialog", { name: TITLE })).toBeHidden();
  expect(await other.evaluate((key) => localStorage.getItem(key), WELCOME_KEY)).toBe("dismissed");
});

test("sessão salva pelo global-setup já traz o card como visto (o tour continua sendo o primeiro passo logado)", async ({ browser }) => {
  const page = await (await browser.newContext({ storageState: authFile("bidder2") })).newPage();
  await page.goto("/");
  expect(await page.evaluate((key) => localStorage.getItem(key), WELCOME_KEY)).toBe("e2e");
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
});
