import { Logger } from "@nestjs/common";
import { createApplication } from "./app";
import { errorReporterFromEnv } from "./observability/error-reporter.service";

/** A5: erro fora de requisição também passa pelo relator (só log, D25). */
const processReporter = errorReporterFromEnv();
process.on("unhandledRejection", (reason) => {
  processReporter.capture(reason, { source: "process" });
});
process.on("uncaughtException", (error) => {
  processReporter.capture(error, { source: "process" });
  process.exitCode = 1;
});

async function bootstrap(): Promise<void> {
  const port = Number(process.env.API_PORT ?? "4300");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("API_PORT inválida.");
  const app = await createApplication();
  await app.listen(port, process.env.API_HOST ?? "127.0.0.1");
}

void bootstrap().catch(() => {
  Logger.error("Não foi possível iniciar a API. Verifique a configuração local.", "Bootstrap");
  process.exitCode = 1;
});
