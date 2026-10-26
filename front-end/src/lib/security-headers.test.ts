import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { clientAddress } from "./api-proxy";
import { buildCsp, createNonce, staticSecurityHeaders } from "./security-headers";

describe("D26 (M2): cabeçalhos de segurança", () => {
  it("CSP com nonce, sem eval em produção e sem moldura", () => {
    const csp = buildCsp("abc", { dev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(buildCsp("abc", { dev: true })).toContain("'unsafe-eval'");
  });

  it("nonce muda a cada requisição", () => {
    expect(createNonce()).not.toBe(createNonce());
  });

  it("HSTS só em produção; DENY, nosniff e Referrer-Policy sempre", () => {
    const keys = (production: boolean) => staticSecurityHeaders(production).map((header) => header.key);
    expect(keys(false)).toEqual(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(staticSecurityHeaders(false)[0].value).toBe("DENY");
  });

  it("o proxy põe a CSP na resposta e o mesmo nonce na requisição", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3300/carteira"));
    const csp = response.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  });
});

describe("D26 (M1): IP do cliente no proxy /api", () => {
  it("usa o primeiro valor válido e descarta lixo", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientAddress(new Headers({ "x-forwarded-for": "::1" }))).toBe("::1");
    expect(clientAddress(new Headers({ "x-forwarded-for": "evil<script>" }))).toBeNull();
    expect(clientAddress(new Headers())).toBeNull();
  });
});
