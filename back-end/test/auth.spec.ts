import { createHmac, randomBytes } from "node:crypto";
import { csrfTokenForSession, safeEqual } from "../src/auth/csrf-token";
import { hashPassword, verifyPassword } from "../src/auth/password-hash";
import { RateLimiter } from "../src/auth/rate-limit";
import { resolveReturnTo } from "../src/auth/return-to";
import { clientIp, sessionCookie } from "../src/auth/session-cookie";

describe("sessão e fronteira", () => {
  it("recusa returnTo externo e aceita só rota local da lista", () => {
    expect(resolveReturnTo("https://evil", "BIDDER")).toEqual({ ok: false });
    expect(resolveReturnTo("//evil", "BIDDER")).toEqual({ ok: false });
    expect(resolveReturnTo("/\\evil", "BIDDER")).toEqual({ ok: false });
    expect(resolveReturnTo("/%2f%2fevil", "BIDDER")).toEqual({ ok: false });
    expect(resolveReturnTo("/carteira/../painel", "AUCTIONEER")).toEqual({ ok: false });
    expect(resolveReturnTo(undefined, "BIDDER")).toEqual({ ok: true, path: "/" });
    expect(resolveReturnTo(undefined, "AUCTIONEER")).toEqual({ ok: true, path: "/painel/lotes" });
    expect(resolveReturnTo("/carteira", "BIDDER")).toEqual({ ok: true, path: "/carteira" });
    expect(resolveReturnTo("/lotes/11111111-1111-4111-8111-111111111111", "BIDDER")).toEqual({
      ok: true,
      path: "/lotes/11111111-1111-4111-8111-111111111111",
    });
  });

  it("limita login, mutação, catálogo, auditoria e SSE na janela de um minuto", () => {
    let now = 1_000;
    const limits = new RateLimiter(() => now);
    for (let attempt = 0; attempt < 10; attempt += 1) limits.consume("login", "203.0.113.8");
    expect(() => limits.consume("login", "203.0.113.8")).toThrow("LIMITE_EXCEDIDO");
    now += 120_000;
    expect(() => limits.consume("login", "203.0.113.8")).not.toThrow();

    for (let attempt = 0; attempt < 60; attempt += 1) limits.consume("mutation", "actor-1");
    expect(() => limits.consume("mutation", "actor-1")).toThrow("LIMITE_EXCEDIDO");
    for (let attempt = 0; attempt < 30; attempt += 1) limits.consume("catalog", "actor-1");
    expect(() => limits.consume("catalog", "actor-1")).toThrow("LIMITE_EXCEDIDO");
    for (let attempt = 0; attempt < 30; attempt += 1) limits.consume("audit", "203.0.113.8");
    expect(() => limits.consume("audit", "203.0.113.8")).toThrow("LIMITE_EXCEDIDO");

    const sseKey = "sessao-1";
    expect(limits.tryAcquireSse(sseKey)).toBe(true);
    expect(limits.tryAcquireSse(sseKey)).toBe(true);
    expect(limits.tryAcquireSse(sseKey)).toBe(true);
    expect(limits.tryAcquireSse(sseKey)).toBe(false);
    limits.releaseSse(sseKey);
    expect(limits.tryAcquireSse(sseKey)).toBe(true);
    expect(limits.tryAcquireSse("anon:203.0.113.9")).toBe(true);
  });

  it("não usa o IP encaminhado e marca o cookie de produção com __Host-", () => {
    const request = {
      socket: { remoteAddress: "::ffff:127.0.0.1" },
      headers: { "x-forwarded-for": "203.0.113.9", host: "evil.example" },
    };
    expect(clientIp(request)).toBe("127.0.0.1");
    const dev = sessionCookie(false);
    const prod = sessionCookie(true);
    expect(dev.name).toBe("session");
    expect(dev.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false, path: "/" });
    expect(dev.options).not.toHaveProperty("domain");
    expect(prod.name).toBe("__Host-session");
    expect(prod.options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(prod.options).not.toHaveProperty("domain");
  });

  it("amarra o CSRF à sessão e usa Argon2id com o mínimo OWASP", async () => {
    const sessionToken = randomBytes(32).toString("base64url");
    const token = csrfTokenForSession(sessionToken);
    expect(token).toBe(csrfTokenForSession(sessionToken));
    expect(token).not.toBe(csrfTokenForSession(randomBytes(32).toString("base64url")));
    expect(token).not.toContain(sessionToken);
    expect(safeEqual(token, token)).toBe(true);
    expect(safeEqual(token, `${token}x`)).toBe(false);
    const expected = createHmac("sha256", sessionToken).update("csrf-v1").digest("base64url");
    expect(token).toBe(expected);

    const encoded = await hashPassword("senha-correta-demonstracao");
    expect(encoded.startsWith("$argon2id$")).toBe(true);
    expect(encoded).toContain("m=19456,t=2,p=1");
    expect(encoded).not.toContain("senha-correta-demonstracao");
    await expect(verifyPassword(encoded, "senha-correta-demonstracao")).resolves.toBe(true);
    await expect(verifyPassword(encoded, "outra-senha")).resolves.toBe(false);
  }, 20000);
});


it.each(["/termos", "/privacidade", "/como-funciona"])("login pode retornar à página pública %s", (destination) => {
  expect(resolveReturnTo(destination, "BIDDER")).toEqual({ ok: true, path: destination });
  expect(resolveReturnTo(destination, "AUCTIONEER")).toEqual({ ok: true, path: destination });
});
