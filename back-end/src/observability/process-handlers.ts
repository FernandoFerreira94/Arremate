import type { ErrorReporter } from "./error-reporter.service";

type ProcessLike = Pick<NodeJS.Process, "on" | "exit">;

/**
 * A5: erro fora de requisição também passa pelo relator (só log, D25).
 * Depois de `uncaughtException` o estado do processo não é confiável: registra e encerra, e o
 * `restart: unless-stopped` do compose sobe a API de novo.
 */
export function installProcessHandlers(reporter: Pick<ErrorReporter, "capture">, target: ProcessLike = process): void {
  target.on("unhandledRejection", (reason) => {
    reporter.capture(reason, { source: "process" });
  });
  target.on("uncaughtException", (error) => {
    reporter.capture(error, { source: "process" });
    target.exit(1);
  });
}
