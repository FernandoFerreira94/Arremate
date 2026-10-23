import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("rewrite same-origin", () => {
  it("não reescreve /api para fora, para o proxy preservar cookie e CSRF", async () => {
    const rewrites = nextConfig.rewrites ? await nextConfig.rewrites() : undefined;
    expect(JSON.stringify(rewrites ?? null)).not.toContain("/api/:path*");
  });
});
