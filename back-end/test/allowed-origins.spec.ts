import "reflect-metadata";
import { defaultOrigins } from "../src/app";

describe("origens do CSRF (QA ALTA 3)", () => {
  it("fora de produção aceita 127.0.0.1:3300 e localhost:3300", () => {
    expect(defaultOrigins({ NODE_ENV: "development" })).toEqual(["http://127.0.0.1:3300", "http://localhost:3300"]);
    expect(defaultOrigins({})).toContain("http://localhost:3300");
  });

  it("em produção mantém a regra: 127.0.0.1:3300 e WEB_ORIGIN válido, sem localhost", () => {
    expect(defaultOrigins({ NODE_ENV: "production" })).toEqual(["http://127.0.0.1:3300"]);
    expect(defaultOrigins({ NODE_ENV: "production", WEB_ORIGIN: "https://arremate.example" })).toEqual(["http://127.0.0.1:3300", "https://arremate.example"]);
    expect(defaultOrigins({ NODE_ENV: "production", WEB_ORIGIN: "https://x.example/path" })).toEqual(["http://127.0.0.1:3300"]);
  });
});
