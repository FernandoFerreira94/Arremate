const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = 'http://127.0.0.1:3300';
async function mockReadOnlyApi(page) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: { statusCode: 401, code: 'SESSAO_NECESSARIA', message: 'Entre na sua conta.' } });
    if (path === '/api/lots') return route.fulfill({ json: { items: [], page: 1, pageSize: 8, total: 0, serverNow: new Date().toISOString() } });
    return route.fulfill({ json: {} });
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let checks = 0;
  try {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await mockReadOnlyApi(page);
    await page.addInitScript(() => {
      const sample = () => {
        const cover = document.querySelector('.brand-intro');
        if (!cover) return requestAnimationFrame(sample);
        const css = getComputedStyle(cover);
        document.documentElement.dataset.firstMotionFrame = JSON.stringify({
          at: performance.now(), visible: css.display !== 'none' && Number(css.opacity) > 0,
        });
      };
      requestAnimationFrame(sample);
    });
    await page.goto('/');
    const first = JSON.parse(await page.locator('html').getAttribute('data-first-motion-frame'));
    assert.equal(first.visible, true);
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-arremate-intro'), undefined, { timeout: 6000 });
    const elapsed = await page.evaluate(() => performance.now()) - first.at;
    assert.ok(elapsed >= 2500, `Splash durou apenas ${elapsed}ms`);
    const entrySeconds = await page.locator('h1').evaluate((node) => parseFloat(getComputedStyle(node).animationDuration));
    assert.equal(entrySeconds, 0.85);
    checks++;

    await page.reload();
    assert.equal(await page.locator('.brand-intro').isVisible(), false);
    checks++;

    await page.goto('/entrar');
    const email = page.getByLabel('Email', { exact: true });
    await email.focus();
    assert.equal(await page.locator('.page-entrance').getAttribute('data-entry-interrupted'), 'true');
    assert.equal(await email.evaluate((node) => getComputedStyle(node.closest('[data-slot="card"]')).opacity), '1');
    await page.getByRole('link', { name: 'Arremate, página inicial' }).focus();
    assert.equal(await page.locator('.page-entrance').getAttribute('data-entry-interrupted'), 'true');
    checks++;
    await context.close();

    for (const mode of ['reduced', 'blocked-storage', 'no-js']) {
      const ctx = await browser.newContext({ baseURL, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference', javaScriptEnabled: mode !== 'no-js' });
      const checkPage = await ctx.newPage();
      await mockReadOnlyApi(checkPage);
      if (mode === 'blocked-storage') await checkPage.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage bloqueado'); } });
      });
      await checkPage.goto('/');
      assert.equal(await checkPage.locator('.brand-intro').isVisible(), false);
      assert.equal(await checkPage.getByRole('link', { name: 'Arremate, página inicial' }).isVisible(), true);
      await ctx.close();
      checks++;
    }
    process.stdout.write(JSON.stringify({ result: 'PASS', checks, splashObservedMs: Math.round(elapsed), entryMs: entrySeconds * 1000, scope: 'browser isolated; API mocked; no database' }) + '\n');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
