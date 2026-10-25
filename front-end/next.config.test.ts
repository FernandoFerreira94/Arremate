import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("rewrite same-origin", () => {
  it("não reescreve /api para fora, para o proxy preservar cookie e CSRF", async () => {
    const rewrites = nextConfig.rewrites ? await nextConfig.rewrites() : undefined;
    expect(JSON.stringify(rewrites ?? null)).not.toContain("/api/:path*");
  });
});


describe("origens da otimização de imagens", () => {
  it("restringe imagens locais à mídia pública sem query", () => {
    expect(nextConfig.images?.localPatterns).toEqual([{ pathname: "/api/media/**", search: "" }]);
  });
  it("aceita só o caminho público HTTPS do Met, sem redirect ou IP privado", () => {
    expect(nextConfig.images?.remotePatterns).toEqual([{ protocol: "https", hostname: "images.metmuseum.org", port: "", pathname: "/CRDImages/**", search: "" }]);
    expect(nextConfig.images?.maximumRedirects).toBe(0);
    expect(nextConfig.images?.dangerouslyAllowLocalIP ?? false).toBe(false);
  });
});
