import { expect, test } from "@playwright/test";
import { DEMO_ACCOUNTS, ensureDemoAccounts } from "./support/demo-users";
import { markTourSeen } from "./support/tour";

/** D27: os botões de conta demo aparecem na Sheet de entrar (build sem NEXT_PUBLIC_DEMO_LOGIN) e entram de verdade. */
test.beforeAll(async () => {
  await ensureDemoAccounts();
});

test.beforeEach(async ({ page }) => {
  await markTourSeen(page);
});

for (const [label, email, role] of [
  ["Entrar como licitante de teste", DEMO_ACCOUNTS.bidder, "BIDDER"],
  ["Entrar como leiloeiro de teste", DEMO_ACCOUNTS.auctioneer, "AUCTIONEER"],
] as const) {
  test(`botão "${label}" aparece na Sheet e loga com ${email}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar" }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Ambiente de demonstração", { exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Entrar como licitante de teste" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Entrar como leiloeiro de teste" })).toBeVisible();
    // Cadastro e login por e-mail continuam na mesma Sheet.
    await expect(sheet.getByRole("tab", { name: /Cadastrar/ })).toBeVisible();

    const login = page.waitForResponse((r) => r.request().method() === "POST" && /\/api\/auth\/login$/.test(r.url()));
    await sheet.getByRole("button", { name: label }).click();
    expect((await login).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Menu da conta" })).toBeVisible();
    const me = await page.request.get("/api/auth/me");
    expect(me.status()).toBe(200);
    expect(((await me.json()) as { role: string }).role).toBe(role);
  });
}
