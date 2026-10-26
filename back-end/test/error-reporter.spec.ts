import type { ErrorEvent } from "../src/observability/error-event";
import { ErrorReporter } from "../src/observability/error-reporter.service";
import { sanitizePath, sanitizeText, sanitizeUrl } from "../src/observability/sanitize";
import { HttpErrorFilter } from "../src/common/http-error.filter";
import { ApiException } from "../src/auth/api.exception";
import type { ArgumentsHost } from "@nestjs/common";

function setup(start = 0) {
  const sent: ErrorEvent[] = [];
  let now = start;
  const reporter = new ErrorReporter({ send: (event) => sent.push(event) }, () => now);
  return { sent, reporter, tick: (ms: number) => (now += ms) };
}

describe("ErrorReporter (A1-A3)", () => {
  it("saneia e-mail, token, query e números longos", () => {
    expect(sanitizeText("falhou para ana@x.com token=abc123 cartao 4111111111111111")).toBe("falhou para [email] token [removido] cartao [num]");
    expect(sanitizePath("/api/lots/1?token=x#y")).toBe("/api/lots/1");
    expect(sanitizeUrl("http://127.0.0.1:3300/lotes/1?senha=x")).toBe("http://127.0.0.1:3300/lotes/1");
  });

  it("agrupa o mesmo erro por 60 s e volta a enviar depois", () => {
    const { sent, reporter, tick } = setup();
    const error = new Error("quebrou");
    reporter.capture(error, { source: "api", path: "/api/x" });
    reporter.capture(error, { source: "api", path: "/api/x" });
    expect(sent).toHaveLength(1);
    tick(60_000);
    reporter.capture(error, { source: "api", path: "/api/x" });
    expect(sent).toHaveLength(2);
  });

  it("limita a 30 eventos por minuto", () => {
    const { sent, reporter, tick } = setup();
    for (let i = 0; i < 40; i += 1) reporter.capture(new Error(`erro ${"x".repeat(i)}`), { source: "api" });
    expect(sent).toHaveLength(30);
    expect(reporter.dropped).toBe(10);
    tick(60_000);
    reporter.capture(new Error("novo"), { source: "api" });
    expect(sent).toHaveLength(31);
  });

  it("nunca lança, mesmo com transporte quebrado", () => {
    const reporter = new ErrorReporter({ send: () => { throw new Error("x"); } });
    expect(() => reporter.capture(new Error("a"), { source: "api" })).not.toThrow();
  });
});

describe("HttpErrorFilter + relator (A4)", () => {
  function run(error: unknown, reporter: ErrorReporter) {
    const out = { status: 0, body: {} as Record<string, unknown> };
    const response = { getHeader: () => "req-9", status(code: number) { out.status = code; return this; }, json(body: Record<string, unknown>) { out.body = body; } };
    const request = { method: "POST", originalUrl: "/api/lots?x=1" };
    const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) } as unknown as ArgumentsHost;
    new HttpErrorFilter(reporter).catch(error, host);
    return out;
  }

  it("relata 500 sem mudar a resposta ao cliente", () => {
    const { sent, reporter } = setup();
    const out = run(new Error("segredo"), reporter);
    expect(out.body).toEqual({ statusCode: 500, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "req-9" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ source: "api", requestId: "req-9", method: "POST", path: "/api/lots", statusCode: 500 });
  });

  it("não relata 4xx nem 503 esperado", () => {
    const { sent, reporter } = setup();
    run(new ApiException(409, "LOT_ENDED"), reporter);
    run(new ApiException(503, "CONFIRMATION_PENDING"), reporter);
    expect(sent).toHaveLength(0);
  });

  it("LIMITE_CONEXOES tem mensagem própria", () => {
    const { reporter } = setup();
    expect(run(new ApiException(429, "LIMITE_CONEXOES"), reporter).body).toMatchObject({ code: "LIMITE_CONEXOES", message: "Muitas pessoas acompanhando este lote agora. Tente em instantes." });
  });
});
