import { expect, test } from "@playwright/test";
import { apiAs, authFile, MET_IDS, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D22 (H2, N1–N4): Avise-me no hero, virada agendado→aberto pelo runner da API, toast de 8 s e painel do sino. */
test("avise-me no hero gera notificação, toast e painel quando o lote abre", async ({ browser }) => {
  test.setTimeout(150_000);
  const lotId = await publishLot(await apiAs("auctioneer"), { startsInMs: 45_000, endsInMs: 30 * 60_000, externalId: "437984" });

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/");
  await expect(guest.getByRole("heading", { name: "Leilões de arte de acervo público" })).toBeVisible();
  await expect(guest.getByRole("button", { name: /^Notificações/ })).toHaveCount(0);
  await guest.context().close();

  const page = await (await browser.newContext({ storageState: authFile("bidder2") })).newPage();
  await markTourSeen(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Próximos leilões" });
  await expect(hero).toBeVisible();
  await hero.getByRole("button", { name: "Avise-me quando abrir" }).click();
  await expect(hero.getByText("Você será avisado")).toBeVisible();
  await hero.getByRole("button", { name: "Cancelar aviso" }).click();
  await expect(hero.getByRole("button", { name: "Avise-me quando abrir" })).toBeVisible();
  await hero.getByRole("button", { name: "Avise-me quando abrir" }).click();
  await expect(hero.getByText("Você será avisado")).toBeVisible();

  const bell = page.getByRole("button", { name: /^Notificações/ });
  await bell.click();
  await expect(page.getByText("Nenhuma notificação")).toBeVisible();
  await page.keyboard.press("Escape");

  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "O lote abriu" }) // D25: N4 agora é um toast Sonner;
  await expect(toast).toBeVisible({ timeout: 100_000 });
  await expect(toast.getByRole("link", { name: "Dar lance" })).toHaveAttribute("href", `/lotes/${lotId}`);
  await expect(toast.getByRole("link", { name: "Ver lote" })).toBeVisible();
  await expect(bell).toHaveAccessibleName("Notificações, 1 não lidas");

  await bell.click();
  await expect(page.getByText("Lote abriu").first()).toBeVisible();
  await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(bell).toHaveAccessibleName("Notificações");
  await page.context().close();
});

/** H2b: carrossel com até 5 agendados, autoplay de 4 s, setas, pontos, teclado, Pausar/Retomar e reduced-motion. */
test("carrossel do hero alterna sozinho, responde a setas, pontos e teclado e respeita reduced-motion", async ({ browser }) => {
  test.setTimeout(90_000);
  const seller = await apiAs("auctioneer");
  await publishLot(seller, { startsInMs: 2 * 3_600_000, endsInMs: 5 * 3_600_000, externalId: MET_IDS[1] });
  await publishLot(seller, { startsInMs: 3 * 3_600_000, endsInMs: 6 * 3_600_000, externalId: MET_IDS[3] });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await markTourSeen(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Próximos leilões" });
  await expect(hero).toHaveAttribute("aria-roledescription", "carrossel");
  const dots = hero.getByRole("button", { name: /^Leilão \d+ de \d+$/ });
  const total = await dots.count();
  expect(total).toBeGreaterThanOrEqual(2);
  expect(total).toBeLessThanOrEqual(5);
  await page.mouse.move(0, 0);
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true", { timeout: 7_000 });

  await hero.getByRole("button", { name: "Pausar" }).click();
  await expect(hero.getByRole("button", { name: "Retomar" })).toBeVisible();
  await hero.getByRole("button", { name: "Próximo leilão" }).click();
  await expect(dots.nth(2 % total)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
  await dots.nth(0).click();
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  await page.mouse.move(0, 0);
  await page.locator("h1").click();
  await page.waitForTimeout(5_000);
  await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
  await expect(hero.getByRole("group", { name: `1 de ${total}` })).toBeVisible();
  await context.close();

  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const still = await reduced.newPage();
  await markTourSeen(still);
  await still.goto("/");
  const quiet = still.getByRole("region", { name: "Próximos leilões" });
  await expect(quiet.getByRole("button", { name: "Leilão anterior" }).first()).toBeAttached();
  await expect(quiet.getByRole("button", { name: "Pausar" })).toHaveCount(0);
  await reduced.close();
});
