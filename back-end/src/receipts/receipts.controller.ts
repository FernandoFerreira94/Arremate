import { Controller, Get, Header, Param } from "@nestjs/common";
import { ReceiptsService } from "./receipts.service";

@Controller()
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get("receipts/:token")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex")
  receipt(@Param("token") token: string) {
    return this.receipts.getReceipt(token);
  }
}
