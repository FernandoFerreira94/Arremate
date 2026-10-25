import { expect, test, type Page } from "@playwright/test";
import { apiAs, authFile, publishLot } from "./support/api-session";
import { ensureE2eUsers, type E2eUser, type E2eUsers } from "./support/demo-users";
import { markTourSeen } from "./support/tour";

let users: E2eUsers;
let lotId: string;
const TITLE_HEART = /favoritar|favoritos/i;

test.beforeAll(async () => {
  users = await ensureE2eUsers();
  lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000, externalId: "436105" });
});

async function sheetLogin(page: Page, user: E2eUser) {
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Email").fill(user.email);
  await sheet.getByLabel("Senha", { exact: true }).fill(user.password);
  await sheet.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("favoritar sem login abre a Sheet e refaz o favorito; aparece em Meus favoritos e sai pela sala", async ({ page }) => {
  await markTourSeen(page);
  await page.goto(`/lotes/${lotId}`);
  const heart = page.getByRole("button", { name: /Entrar para favoritar/ });
  await heart.click();
  await sheetLogin(page, users.bidder2);
  const active = page.getByRole("button", { name: /Remover .* dos favoritos/ });
  await expect(active).toHaveAttribute("aria-pressed", "true");
  await expect(active).toContainText("Favoritado");

  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Meus favoritos" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Meus favoritos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Remover .* dos favoritos/ })).toHaveCount(1);

  await page.goto(`/lotes/${lotId}`);
  await page.getByRole("button", { name: /Remover .* dos favoritos/ }).click();
  await expect(page.getByRole("button", { name: TITLE_HEART }).first()).toHaveAttribute("aria-pressed", "false");
  await page.goto("/favoritos");
  await expect(page.getByText("Você ainda não favoritou nenhum lote")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver a vitrine" })).toBeVisible();
});

test("tour abre no primeiro acesso logado, navega por teclado, Esc pula e não volta", async ({ browser }) => {
  // Sessão salva pelo global-setup (sem novo login, por causa do limite de 10 logins/min por IP).
  const page = await (await browser.newContext({ storageState: authFile("bidder") })).newPage();
  await page.goto("/");
  const tour = page.getByRole("dialog", { name: "Navegação" });
  await expect(tour).toBeVisible();
  await expect(tour.getByText("1/7")).toBeVisible();
  await expect(tour.getByRole("button", { name: /Pular/ })).toBeVisible();
  const cutout = page.getByTestId("tour-cutout");
  const first = await cutout.boundingBox();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Seu saldo" })).toBeVisible();
  await expect.poll(async () => JSON.stringify(await cutout.boundingBox())).not.toBe(JSON.stringify(first));
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("dialog", { name: "Navegação" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Menu da conta" }).click();
  await page.getByRole("menuitem", { name: "Ver tour de novo" }).click();
  await expect(page.getByRole("dialog", { name: "Navegação" })).toBeVisible();
  for (let i = 0; i < 6; i += 1) await page.getByRole("button", { name: /Próximo/ }).click();
  await expect(page.getByRole("dialog", { name: "Seu perfil" })).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
