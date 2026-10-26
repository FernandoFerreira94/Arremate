import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiException } from "../auth/api.exception";
import { RateLimiter } from "../auth/rate-limit";
import { clientIp } from "../auth/session-cookie";
import { LotEventsService } from "./lot-events.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HEARTBEAT_MS = 15_000;

@Controller()
export class EventsController {
  constructor(
    private readonly events: LotEventsService,
    private readonly limits: RateLimiter,
  ) {}

  /** SSE público por lote. Sem sessão, sem carteira: só avisa que o snapshot mudou. */
  @Get("events")
  stream(@Query("lotId") lotId: string | undefined, @Req() request: Request, @Res() response: Response): void {
    if (typeof lotId !== "string" || !UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const id = lotId.toLowerCase();
    // D26 (B3): no máximo 3 conexões SSE por IP real.
    const ip = clientIp(request);
    if (!this.limits.tryAcquireSse(ip)) throw new ApiException(429, "LIMITE_CONEXOES");
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = this.events.subscribe(id, (event) => {
        response.write(`id: ${event.revision}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
    } catch (error) {
      this.limits.releaseSse(ip);
      throw error;
    }
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Accel-Buffering", "no");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    response.write(`retry: 5000\nevent: ready\ndata: {"lotId":"${id}"}\n\n`);
    const heartbeat = setInterval(() => response.write("event: ping\ndata: {}\n\n"), HEARTBEAT_MS);
    heartbeat.unref();
    request.on("close", () => {
      clearInterval(heartbeat);
      if (unsubscribe) this.limits.releaseSse(ip);
      unsubscribe?.();
      unsubscribe = null;
    });
  }
}
