import { Controller, Get, Header, Param, Req } from "@nestjs/common";
import type { Request } from "express";
import { consumeOrThrow } from "../auth/csrf.guard";
import { RateLimiter } from "../auth/rate-limit";
import { clientIp } from "../auth/session-cookie";
import { ReceiptsService } from "./receipts.service";

@Controller()
export class ReceiptsController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly limits: RateLimiter,
  ) {}

  @Get("receipts/:token")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex")
  receipt(@Param("token") token: string, @Req() request: Request) {
    // Auditoria item 9: verificação pública reexecuta a auditoria; limite por IP no bucket "audit".
    consumeOrThrow(this.limits, "audit", clientIp(request));
    return this.receipts.getReceipt(token);
  }
}
