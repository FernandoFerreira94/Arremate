import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import type { LotsService } from "./lots.service";

/**
 * D21 (N1–N4): varre as inscrições "Avise-me" cujo lote virou de agendado para aberto e gera as notificações.
 * Mesmo modelo do SettlementRunner: o banco é a fila, uma rodada por vez, e a instrução única é idempotente.
 */
export class NotificationRunner implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly lots: LotsService,
    private readonly intervalMs: number | false,
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

  async tick(): Promise<number> {
    if (this.busy) return 0;
    this.busy = true;
    try {
      return await this.lots.generateOpenedNotifications();
    } catch {
      this.logger.error("Varredura de notificações falhou; nova tentativa no próximo intervalo.");
      return 0;
    } finally {
      this.busy = false;
    }
  }
}
