import { expect, test } from "@playwright/test";
import { markTourSeen } from "./support/tour";

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

test("vitrine pública: título, abas e estado vazio ou cartões, sem login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Leilões de arte de acervo público" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Ao vivo/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Agendados/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Encerrados/ })).toBeVisible();
  await expect(page.getByText(/Nenhum lote ao vivo|Abrir sala/).first()).toBeVisible();
  await page.getByRole("tab", { name: /Agendados/ }).click();
  await expect(page.getByText(/Nenhum lote agendado|Avise-me|Avisaremos/).first()).toBeVisible();
});

test("abas da vitrine contam todos os lotes e filtram no servidor, não só a página atual", async ({ page }) => {
  const api = await page.request.get("/api/lots");
  expect(api.ok()).toBe(true);
  const { counts } = (await api.json()) as { counts: Record<"live" | "scheduled" | "ended" | "ending", number> };
  await page.goto("/");
  await expect(page.getByRole("tab", { name: `Ao vivo (${counts.live})` })).toBeVisible();
  await expect(page.getByRole("tab", { name: `Agendados (${counts.scheduled})` })).toBeVisible();
  await expect(page.getByRole("tab", { name: `Encerrados (${counts.ended})` })).toBeVisible();
  await page.getByRole("tab", { name: /Encerrados/ }).click();
  await expect(page).toHaveURL(/aba=encerrados/);
  const cards = page.getByRole("list", { name: "Lotes da aba" }).getByRole("listitem");
  if (counts.ended === 0) await expect(page.getByText("Nenhum lote encerrado")).toBeVisible();
  else await expect(cards).toHaveCount(Math.min(counts.ended, 8));
});

test("sala no celular: preço e lance vêm antes da ficha da obra (code review item 3)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const list = (await (await page.request.get("/api/lots?state=live")).json()) as { items: { id: string }[] };
  test.skip(list.items.length === 0, "sem lote ao vivo no banco de teste");
  await markTourSeen(page);
  await page.goto(`/lotes/${list.items[0]?.id}`);
  const price = await page.getByTestId("current-price").boundingBox();
  const about = await page.getByText("Sobre o lote").boundingBox();
  expect(price && about && price.y < about.y).toBe(true);
  await context.close();
});

test("comprovante com token válido mas inexistente mostra erro real, sem selo positivo", async ({ page }) => {
  await page.goto(`/comprovantes/${"A".repeat(32)}`);
  await expect(page.getByText("Comprovante não encontrado. Confira o link recebido.")).toBeVisible();
  await expect(page.getByText("Íntegro.")).toHaveCount(0);
});
