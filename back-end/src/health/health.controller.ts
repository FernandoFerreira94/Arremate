import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseRepository } from "../database/database.repository";

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseRepository) {}

  @Get("live")
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<{ status: "ok"; database: "up" }> {
    try {
      await this.database.ping();
      return { status: "ok", database: "up" };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
