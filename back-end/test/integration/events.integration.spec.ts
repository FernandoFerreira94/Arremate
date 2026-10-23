import "reflect-metadata";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createApplication } from "../../src/app";
import { LotEventsService } from "../../src/lots/lot-events.service";

jest.setTimeout(30_000);

const LOT = "0b7f8f0e-5d2f-4c55-9a51-3a1e0a6c1d09";

describe("SSE /api/events e auditoria pública", () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Configure TEST_DATABASE_URL para testar PostgreSQL real.");
  let app: INestApplication;
  let base = "";

  beforeAll(async () => {
    app = await createApplication({ connectionString, logger: false, auditKey: null, settlementIntervalMs: false });
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lotId inválido responde 404 sem abrir stream", async () => {
    const response = await fetch(`${base}/api/events?lotId=x`);
    expect(response.status).toBe(404);
  });

  it("abre stream público, envia ready e repassa lot.updated sem PII; fechar libera o ouvinte", async () => {
    const events = app.get(LotEventsService);
    const controller = new AbortController();
    const response = await fetch(`${base}/api/events?lotId=${LOT}`, { signal: controller.signal });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(response.headers.get("cache-control")).toMatch(/no-store|no-cache/);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const until = async (needle: string) => {
      while (!text.includes(needle)) {
        const chunk = await reader.read();
        if (chunk.done) break;
        text += decoder.decode(chunk.value);
      }
    };
    await until("event: ready");
    expect(events.listenerCount(LOT)).toBe(1);
    events.publish(LOT);
    await until("lot.updated");
    expect(text).toContain(`"lotId":"${LOT}"`);
    expect(text).not.toMatch(/@|userId|wallet/);
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(events.listenerCount(LOT)).toBe(0);
  });

  it("auditoria pública de lote inexistente responde 404; sem chave nunca é INTACT", async () => {
    expect((await fetch(`${base}/api/lots/${LOT}/audit`)).status).toBe(404);
  });
});
