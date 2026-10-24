import { HttpErrorFilter } from "../src/common/http-error.filter";
import type { ArgumentsHost } from "@nestjs/common";

function run(error: unknown): { status: number; body: Record<string, unknown> } {
  const out = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    getHeader: () => "req-1",
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      out.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  new HttpErrorFilter().catch(error, host);
  return out;
}

describe("HttpErrorFilter", () => {
  it("corpo acima do limite do body-parser responde 413 com codigo seguro, nao 500", () => {
    const tooLarge = Object.assign(new Error("request entity too large"), { status: 413, statusCode: 413, type: "entity.too.large", expose: true });
    expect(run(tooLarge)).toEqual({ status: 413, body: { statusCode: 413, code: "CORPO_GRANDE_DEMAIS", message: expect.any(String), requestId: "req-1" } });
  });

  it("erro desconhecido continua 500 sem vazar mensagem", () => {
    const result = run(new Error("segredo interno"));
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain("segredo");
  });
});