import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiException } from "../auth/api.exception";
import { LotEventsService } from "./lot-events.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const HEARTBEAT_MS = 15_000;

@Controller()
export class EventsController {
  constructor(private readonly events: LotEventsService) {}

  /** SSE público por lote. Sem sessão, sem carteira: só avisa que o snapshot mudou. */
  @Get("events")
  stream(@Query("lotId") lotId: string | undefined, @Req() request: Request, @Res() response: Response): void {
    if (typeof lotId !== "string" || !UUID.test(lotId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const id = lotId.toLowerCase();
    let unsubscribe: (() => void) | null = null;
    unsubscribe = this.events.subscribe(id, (event) => {
      response.write(`id: ${event.revision}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
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
      unsubscribe?.();
      unsubscribe = null;
    });
  }
}
