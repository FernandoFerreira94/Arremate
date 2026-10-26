import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./api-error";
import { allowReport, resetReporterForTests, shouldReport, toReport } from "./error-reporter";

describe("relator de erros do navegador (A6)", () => {
  beforeEach(() => resetReporterForTests());

  it("não relata ApiError 4xx nem confirmação pendente; relata 5xx e erro comum", () => {
    expect(shouldReport(new ApiError({ statusCode: 409, code: "LOT_ENDED", message: "x", requestId: "r" }))).toBe(false);
    expect(shouldReport(new ApiError({ statusCode: 503, code: "CONFIRMATION_PENDING", message: "x", requestId: "r" }))).toBe(false);
    expect(shouldReport(new ApiError({ statusCode: 500, code: "ERRO_INTERNO", message: "x", requestId: "r" }))).toBe(true);
    expect(shouldReport(new TypeError("quebrou"))).toBe(true);
  });

  it("limita a 5 relatos por 60 s por aba", () => {
    const results = Array.from({ length: 7 }, (_, i) => allowReport(`erro-${i}`, 1000));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(allowReport("depois", 62_000)).toBe(true);
  });

  it("monta o relato com mensagem curta e digest", () => {
    const report = toReport(new Error("a".repeat(900)), "d1");
    expect(report.message).toHaveLength(500);
    expect(report.digest).toBe("d1");
  });
});
