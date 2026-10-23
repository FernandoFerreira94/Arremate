import { describe, expect, it } from "vitest";
import { pageMetadata, siteUrl } from "./page-metadata";

describe("siteUrl", () => {
  it("usa SITE_URL só se estiver na allowlist de formato; senão o local", () => {
    expect(siteUrl("https://arremate.example.com")).toBe("https://arremate.example.com");
    expect(siteUrl("javascript:alert(1)")).toBe("http://127.0.0.1:3300");
    expect(siteUrl("https://evil.com/path?x")).toBe("http://127.0.0.1:3300");
    expect(siteUrl(undefined)).toBe("http://127.0.0.1:3300");
  });
});

describe("pageMetadata", () => {
  it("monta título, descrição, canonical, OG/Twitter e noindex", () => {
    const meta = pageMetadata({ title: "Vitrine", description: "Lotes", path: "/lotes/abc", base: "http://127.0.0.1:3300" });
    expect(meta.title).toBe("Vitrine");
    expect(meta.alternates?.canonical).toBe("http://127.0.0.1:3300/lotes/abc");
    expect(meta.openGraph).toMatchObject({ title: "Vitrine · Arremate", siteName: "Arremate", locale: "pt_BR", url: "http://127.0.0.1:3300/lotes/abc" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it("path com query ou esquema é normalizado para o caminho", () => {
    const meta = pageMetadata({ title: "x", description: "y", path: "/a?b=<script>", base: "http://127.0.0.1:3300" });
    expect(meta.alternates?.canonical).toBe("http://127.0.0.1:3300/a");
  });

  it("título longo é cortado", () => {
    const meta = pageMetadata({ title: "a".repeat(200), description: "d".repeat(400), path: "/", base: "http://127.0.0.1:3300" });
    expect(String(meta.title).length).toBeLessThanOrEqual(70);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
  });
});
