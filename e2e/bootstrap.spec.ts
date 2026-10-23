import { test, expect } from "@playwright/test";

test("base técnica acessível, sem simular produto concluído", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Casa de Leilões" })).toBeVisible();
  await expect(page.getByText("Aguardando as pranchas e o design system aprovados.")).toBeVisible();
});

test("metadados e noindex chegam no HTML inicial sem JavaScript", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<html lang="pt-BR"');
  expect(html).toContain("<title>Casa de Leilões — demonstração</title>");
  expect(html).toMatch(/name="robots" content="[^"]*noindex/);
  expect(html).not.toContain("Internal server error");
  const missing = await request.get("/pagina-que-nao-existe");
  expect(missing.status()).toBe(404);
});
