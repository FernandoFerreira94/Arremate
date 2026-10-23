import { describe, expect, it } from "vitest";
import { apiProxyTarget, upstreamHeaders } from "./api-proxy";

describe("proxy da API", () => {
  it("usa o destino fixo e encaminha só cookie, origem e CSRF", () => {
    const previous = process.env.API_PROXY_TARGET;
    process.env.API_PROXY_TARGET = "http://127.0.0.1:4311";
    try {
      expect(apiProxyTarget()).toBe("http://127.0.0.1:4311");
      const headers = new Headers({
        cookie: "session=opaco",
        origin: "http://127.0.0.1:3311",
        "x-csrf-token": "csrf-de-teste",
        "content-type": "application/json",
        host: "evil.example",
        "x-forwarded-for": "203.0.113.9",
      });
      const forwarded = upstreamHeaders(headers);
      expect(forwarded.get("cookie")).toBe("session=opaco");
      expect(forwarded.get("origin")).toBe("http://127.0.0.1:3311");
      expect(forwarded.get("x-csrf-token")).toBe("csrf-de-teste");
      expect(forwarded.get("content-type")).toBe("application/json");
      expect(forwarded.get("host")).toBeNull();
      expect(forwarded.get("x-forwarded-for")).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.API_PROXY_TARGET;
      else process.env.API_PROXY_TARGET = previous;
    }
  });

  it("recusa destino que não é uma origem exata", () => {
    const previous = process.env.API_PROXY_TARGET;
    process.env.API_PROXY_TARGET = "http://evil.example/api";
    try {
      expect(apiProxyTarget()).toBe("http://127.0.0.1:4300");
    } finally {
      if (previous === undefined) delete process.env.API_PROXY_TARGET;
      else process.env.API_PROXY_TARGET = previous;
    }
  });
});
