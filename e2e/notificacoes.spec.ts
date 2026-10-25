import { expect, test } from "@playwright/test";
import { apiAs, authFile, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D21 (H2, N1–N4): Avise-me no hero, virada agendado→aberto pelo runner da API, toast de 8 s e painel do sino. */
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
  const hero = page.getByRole("region", { name: /./ }).filter({ hasText: "Próximo leilão" });
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

  const toast = page.getByRole("status").filter({ hasText: "O lote abriu" });
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
