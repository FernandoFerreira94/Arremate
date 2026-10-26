import { expect, test } from "@playwright/test";
import { apiAs, publishLot } from "./support/api-session";
import { markTourSeen } from "./support/tour";

/** D26 (M2): cabeçalhos de segurança no front sem quebrar scripts, imagens e SSE. */
test("páginas têm CSP com nonce, DENY e nosniff, sem violação de CSP na vitrine e na sala", async ({ page }) => {
  const lotId = await publishLot(await apiAs("auctioneer"), { endsInMs: 30 * 60_000, externalId: "437329" });
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  await markTourSeen(page);
  const home = await page.goto("/");
  const headers = home?.headers() ?? {};
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  const nonce = /'nonce-([^']+)'/.exec(headers["content-security-policy"] ?? "")?.[1];
  expect(await page.locator("#arremate-intro-boot").evaluate((element) => (element as HTMLScriptElement).nonce)).toBe(nonce);
  await expect(page.getByRole("heading", { name: "Leilões de arte de acervo público" })).toBeVisible();

  const events = page.waitForResponse((response) => response.url().includes(`/api/events?lotId=${lotId}`));
  await page.goto(`/lotes/${lotId}`);
  expect((await events).status()).toBe(200);
  const image = page.locator("figure img");
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const api = await page.request.get("/api/lots");
  expect(api.headers()["x-frame-options"]).toBe("DENY");
  expect(api.headers()["x-content-type-options"]).toBe("nosniff");
  expect(violations).toEqual([]);
});
