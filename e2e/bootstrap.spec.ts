import { test, expect } from "@playwright/test";

test("início com a identidade aprovada e acesso à entrada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Leilões de arte de acervo público", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Arremate, página inicial" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toBeVisible();
});

test("metadados e noindex chegam no HTML inicial sem JavaScript", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<html lang="pt-BR"');
  expect(html).toContain("<title>Arremate — demonstração</title>");
  expect(html).toMatch(/name="robots" content="[^"]*noindex/);
  expect(html).not.toContain("Internal server error");
  const missing = await request.get("/pagina-que-nao-existe");
  expect(missing.status()).toBe(404);
});
