import { expect, test } from "@playwright/test";

/** Metadados via HTTP puro (sem JS): o que um crawler ou preview social lê. */
function head(html: string) {
  const pick = (re: RegExp) => html.match(re)?.[1] ?? null;
  return {
    title: pick(/<title>([^<]*)<\/title>/),
    description: pick(/<meta name="description" content="([^"]*)"/),
    canonical: pick(/<link rel="canonical" href="([^"]*)"/),
    robots: pick(/<meta name="robots" content="([^"]*)"/),
    ogTitle: pick(/<meta property="og:title" content="([^"]*)"/),
    ogImage: pick(/<meta property="og:image" content="([^"]*)"/),
  };
}

test("vitrine tem título, descrição, canonical, OG e noindex próprios", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const meta = head(await response.text());
  expect(meta.title).toBe("Arremate — demonstração");
  expect(meta.description).toContain("Leilões simulados");
  expect(meta.canonical).toBe("http://127.0.0.1:3300");
  expect(meta.robots).toContain("noindex");
  expect(meta.ogTitle).toBe("Arremate — demonstração");
  expect(meta.ogImage).toMatch(/\/opengraph-image/);
});

test("Host e query forjados não mudam a origem do canonical nem entram no head", async ({ request }) => {
  const response = await request.get("/?page=%22%3E%3Cscript%3Ealert(1)%3C/script%3E", { headers: { Host: "evil.example", "X-Forwarded-Host": "evil.example" } });
  const html = await response.text();
  expect(head(html).canonical).toBe("http://127.0.0.1:3300");
  expect(html).not.toContain("evil.example");
  expect(html).not.toContain("<script>alert(1)</script>");
});

test("lote e comprovante inexistentes respondem 404 de verdade, com noindex", async ({ request }) => {
  for (const path of ["/lotes/00000000-0000-4000-8000-000000000000", "/lotes/nao-e-uuid", "/lotes/00000000-0000-4000-8000-000000000000/auditoria", "/comprovantes/curto"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(head(await response.text()).robots, path).toContain("noindex");
  }
});

test("páginas privadas têm noindex e não entregam dados ao anônimo", async ({ request }) => {
  for (const path of ["/carteira", "/meus-arremates", "/painel/lotes"]) {
    const html = await (await request.get(path)).text();
    expect(head(html).robots, path).toContain("noindex");
    expect(html, path).not.toMatch(/availableCents|totalCents|@arremate\.test/);
  }
});

test("assets sociais e robots com status e MIME corretos; robots não bloqueia leitura do noindex", async ({ request }) => {
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toBe("image/png");
  for (const path of ["/icon", "/apple-icon"]) {
    const icon = await request.get(path);
    expect(icon.status(), path).toBe(200);
    expect(icon.headers()["content-type"], path).toBe("image/png");
  }
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).not.toMatch(/Disallow: \/\s*$/m);
});

test("canal SSE público abre pelo proxy e não fala de carteira", async ({ page }) => {
  await page.goto("/");
  const text = await page.evaluate(async () => {
    const response = await fetch("/api/events?lotId=00000000-0000-4000-8000-000000000000");
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    await reader.cancel();
    return `${response.status} ${response.headers.get("content-type")} ${new TextDecoder().decode(chunk.value)}`;
  });
  expect(text).toMatch(/^200 text\/event-stream/);
  expect(text).toContain("event: ready");
  expect(text).not.toMatch(/wallet|@|userId/);
});
