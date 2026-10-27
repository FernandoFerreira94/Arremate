import "reflect-metadata";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Logger, Module, ValidationPipe } from "@nestjs/common";
import type { DynamicModule, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { ClientErrorsController } from "./observability/client-errors.controller";
import { ErrorReporter, errorReporterFromEnv } from "./observability/error-reporter.service";
import { GoogleController } from "./auth/google.controller";
import { GoogleRepository } from "./auth/google.repository";
import { GoogleService, googleConfig, type GoogleConfig, type GoogleFetch } from "./auth/google.service";
import { AuthController } from "./auth/auth.controller";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import { AuditRepository } from "./audit/audit.repository";
import { AuditService } from "./audit/audit.service";
import { FileCheckpointStore } from "./audit/checkpoint-store";
import { CatalogController } from "./catalog/catalog.controller";
import { CatalogService } from "./catalog/catalog.service";
import { MediaStore } from "./catalog/image-importer";
import { MetCatalogClient, type FetchLike, type LookupLike } from "./catalog/met-catalog.client";
import { BiddingRepository } from "./lots/bidding.repository";
import { BiddingService } from "./lots/bidding.service";
import { EventsController } from "./lots/events.controller";
import { LotEventsService } from "./lots/lot-events.service";
import { LotsController } from "./lots/lots.controller";
import { LotsRepository } from "./lots/lots.repository";
import { LotsService } from "./lots/lots.service";
import { SettlementRepository } from "./lots/settlement.repository";
import { DemoBotRunner, demoBotConfig, type DemoBotConfig } from "./lots/demo-bot-runner";
import { NotificationRunner } from "./lots/notification-runner";
import { SettlementRunner } from "./lots/settlement-runner";
import { SettlementService } from "./lots/settlement.service";
import { ReceiptsController } from "./receipts/receipts.controller";
import { ReceiptsRepository } from "./receipts/receipts.repository";
import { ReceiptsService } from "./receipts/receipts.service";
import { WalletsController } from "./wallets/wallets.controller";
import { WalletsRepository } from "./wallets/wallets.repository";
import { WalletsService } from "./wallets/wallets.service";
import { CsrfGuard } from "./auth/csrf.guard";
import { MutationRateLimitGuard } from "./auth/mutation-rate-limit.guard";
import { RateLimiter } from "./auth/rate-limit";
import { RolesGuard } from "./auth/roles.guard";
import { SessionGuard } from "./auth/session.guard";
import { DatabaseRepository } from "./database/database.repository";
import { HealthController } from "./health/health.controller";
import { HttpErrorFilter } from "./common/http-error.filter";

interface ApplicationOptions {
  googleConfig?: GoogleConfig | null;
  googleFetch?: GoogleFetch;
  database?: Pick<DatabaseRepository, "ping">;
  connectionString?: string;
  logger?: false;
  now?: () => number;
  allowedOrigins?: readonly string[];
  productionCookies?: boolean;
  catalogFetch?: FetchLike;
  catalogLookup?: LookupLike;
  mediaDir?: string;
  auditKey?: Uint8Array | null;
  witnessDir?: string;
  /** Intervalo do runner de liquidação; false desliga (padrão em NODE_ENV=test). */
  settlementIntervalMs?: number | false;
  /** D22: intervalo da varredura agendado→aberto que gera notificações; false desliga (padrão em NODE_ENV=test). */
  notificationIntervalMs?: number | false;
  /** D31: licitantes automáticos da demo; padrão vem do ambiente (DEMO_BOTS=1), sempre desligado em NODE_ENV=test. */
  demoBots?: DemoBotConfig | false;
  /** D25: relator de erros (padrão: só log). */
  errorReporter?: ErrorReporter;
}

@Module({})
class ApplicationModule {
  static register(options: ApplicationOptions): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [HealthController, AuthController, GoogleController, CatalogController, LotsController, WalletsController, ReceiptsController, EventsController, ClientErrorsController],
      providers: [
        {
          provide: DatabaseRepository,
          useFactory: () => {
            if (options.database) return options.database;
            const connectionString = options.connectionString ?? process.env.DATABASE_URL;
            if (!connectionString) throw new Error("Configure DATABASE_URL antes de iniciar a API.");
            return new DatabaseRepository(connectionString);
          },
        },
        AuthRepository,
        { provide: GoogleRepository, useFactory: (database: DatabaseRepository) => new GoogleRepository(database), inject: [DatabaseRepository] },
        { provide: GoogleService, useFactory: (repository: GoogleRepository, auth: AuthService) => {
          const production = options.productionCookies ?? process.env.NODE_ENV === "production";
          return new GoogleService(repository,auth,options.googleConfig !== undefined ? options.googleConfig : googleConfig(options.allowedOrigins ?? defaultOrigins(),production),production,options.googleFetch);
        }, inject: [GoogleRepository, AuthService] },
        { provide: ErrorReporter, useFactory: () => options.errorReporter ?? errorReporterFromEnv() },
        { provide: RateLimiter, useFactory: () => new RateLimiter(options.now ?? Date.now) },
        {
          provide: AuthService,
          useFactory: (repository: AuthRepository) => new AuthService(
            repository,
            options.allowedOrigins ?? defaultOrigins(),
            options.productionCookies ?? process.env.NODE_ENV === "production",
          ),
          inject: [AuthRepository],
        },
        { provide: MediaStore, useFactory: () => new MediaStore(options.mediaDir ?? process.env.MEDIA_DIR ?? resolve(__dirname, "../../.data/media")) },
        { provide: MetCatalogClient, useFactory: () => new MetCatalogClient({ fetch: options.catalogFetch, lookup: options.catalogLookup }) },
        {
          provide: CatalogService,
          useFactory: (client: MetCatalogClient, database: DatabaseRepository, media: MediaStore) => new CatalogService(client, database, media),
          inject: [MetCatalogClient, DatabaseRepository, MediaStore],
        },
        {
          provide: AuditService,
          useFactory: (database: DatabaseRepository) => {
            const key = options.auditKey !== undefined ? options.auditKey : auditKeyFromEnv();
            const pool = (database as Partial<DatabaseRepository>).connectionPool;
            if (!key || !pool) return null;
            const witnessDir = options.witnessDir ?? process.env.AUDIT_WITNESS_DIR ?? resolve(__dirname, "../../.data/witness");
            return new AuditService(new AuditRepository(pool, "public"), new FileCheckpointStore(witnessDir), key);
          },
          inject: [DatabaseRepository],
        },
        { provide: LotEventsService, useFactory: () => new LotEventsService() },
        { provide: LotsRepository, useFactory: (database: DatabaseRepository) => new LotsRepository(database), inject: [DatabaseRepository] },
        {
          provide: LotsService,
          useFactory: (database: DatabaseRepository, lots: LotsRepository, catalog: CatalogService, audit: AuditService | null) =>
            new LotsService(database, lots, catalog, audit),
          inject: [DatabaseRepository, LotsRepository, CatalogService, AuditService],
        },
        {
          provide: BiddingService,
          useFactory: (database: DatabaseRepository, audit: AuditService | null) => new BiddingService(database, audit, new BiddingRepository()),
          inject: [DatabaseRepository, AuditService],
        },
        {
          provide: SettlementService,
          useFactory: (database: DatabaseRepository, audit: AuditService | null) => new SettlementService(database, audit, new SettlementRepository()),
          inject: [DatabaseRepository, AuditService],
        },
        {
          provide: SettlementRunner,
          useFactory: (settlement: SettlementService, events: LotEventsService) =>
            new SettlementRunner(settlement, options.settlementIntervalMs ?? (process.env.NODE_ENV === "test" ? false : 1000), events),
          inject: [SettlementService, LotEventsService],
        },
        {
          provide: NotificationRunner,
          useFactory: (lots: LotsService) =>
            new NotificationRunner(lots, options.notificationIntervalMs ?? (process.env.NODE_ENV === "test" ? false : 5000)),
          inject: [LotsService],
        },
        {
          provide: ReceiptsService,
          useFactory: (database: DatabaseRepository, audit: AuditService | null) => new ReceiptsService(new ReceiptsRepository(database), audit),
          inject: [DatabaseRepository, AuditService],
        },
        { provide: WalletsRepository, useFactory: (database: DatabaseRepository) => new WalletsRepository(database), inject: [DatabaseRepository] },
        {
          provide: WalletsService,
          useFactory: (database: DatabaseRepository, wallets: WalletsRepository) => new WalletsService(database, wallets),
          inject: [DatabaseRepository, WalletsRepository],
        },
        {
          provide: DemoBotRunner,
          useFactory: (database: DatabaseRepository, bidding: BiddingService, wallets: WalletsService, events: LotEventsService) =>
            new DemoBotRunner(database, bidding, wallets, events, options.demoBots !== undefined ? options.demoBots : demoBotConfig()),
          inject: [DatabaseRepository, BiddingService, WalletsService, LotEventsService],
        },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: MutationRateLimitGuard },
      ],
    };
  }
}

export async function createApplication(options: ApplicationOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(ApplicationModule.register(options), { logger: options.logger, abortOnError: false });
  const http = app.getHttpAdapter().getInstance();
  // D26 (M1): confia só no salto local (o proxy /api do Next); X-Forwarded-For vindo de fora é ignorado.
  http.set("trust proxy", "loopback");
  http.disable("x-powered-by");
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Request-Id", randomUUID());
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter(app.get(ErrorReporter)));
  app.enableShutdownHooks();
  return app;
}

/** Sem chave válida a API sobe, mas todo lance responde 503: o boot avisa em vez de falhar calado. */
export function auditKeyFromEnv(env: NodeJS.ProcessEnv = process.env, logger: Pick<Logger, "error"> = new Logger("Auditoria")): Uint8Array | null {
  const raw = env.AUDIT_HMAC_KEY;
  if (typeof raw === "string" && /^(?:[0-9a-fA-F]{2}){32,}$/.test(raw)) return Buffer.from(raw, "hex");
  logger.error(
    `AUDIT_HMAC_KEY ${raw ? "inválida" : "ausente"}: use 64+ caracteres hexadecimais (openssl rand -hex 32). Sem ela, lances e auditoria respondem 503.`,
  );
  return null;
}

/**
 * Origens aceitas pelo CSRF. Em produção, só 127.0.0.1:3300 e WEB_ORIGIN (regra de antes).
 * QA ALTA 3: fora de produção também aceita http://localhost:3300, o mesmo front local por outro nome.
 */
export function defaultOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = ["http://127.0.0.1:3300"];
  if (env.NODE_ENV !== "production") origins.push("http://localhost:3300");
  const extra = env.WEB_ORIGIN;
  if (typeof extra === "string" && /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(extra) && !origins.includes(extra)) origins.push(extra);
  return origins;
}
