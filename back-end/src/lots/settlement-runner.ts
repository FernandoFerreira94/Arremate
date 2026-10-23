import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import type { LotEventsService } from "./lot-events.service";
import type { SettlementService } from "./settlement.service";

/**
 * Varredura no startup e a cada intervalo, sem job por lote em memória: o banco é a fila.
 * Uma rodada por vez; a ordem/lock no banco protege contra várias instâncias.
 */
export class SettlementRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SettlementRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> = Promise.resolve();
  private busy = false;

  constructor(
    private readonly settlement: SettlementService,
    private readonly intervalMs: number | false,
    private readonly events?: LotEventsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.intervalMs === false) return;
    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  idle(): Promise<void> {
    return this.running;
  }

  private tick(): Promise<void> {
    if (this.busy) return this.running;
    this.busy = true;
    this.running = this.settlement
      .settleDueLots((lotId) => this.events?.publish(lotId))
      .then((summary) => {
        if (summary.failed > 0) this.logger.warn(`Liquidação: ${summary.failed} falha(s) nesta rodada.`);
      })
      .catch(() => this.logger.error("Varredura de liquidação falhou; nova tentativa no próximo intervalo."))
      .finally(() => {
        this.busy = false;
      });
    return this.running;
  }
}
