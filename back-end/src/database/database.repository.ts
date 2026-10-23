import { Pool } from "pg";
import type { OnModuleDestroy } from "@nestjs/common";
import { Logger } from "@nestjs/common";

export class DatabaseRepository implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(DatabaseRepository.name);

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000, idleTimeoutMillis: 10000 });
    this.pool.on("error", () => {
      this.logger.warn("Conexão ociosa do banco foi encerrada; próximas consultas tentarão reconectar.");
    });
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
