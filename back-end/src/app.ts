import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Module, ValidationPipe } from "@nestjs/common";
import type { DynamicModule, INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { AuthController } from "./auth/auth.controller";
import { AuthRepository } from "./auth/auth.repository";
import { AuthService } from "./auth/auth.service";
import { AuthorizationController } from "./auth/authorization.controller";
import { CsrfGuard } from "./auth/csrf.guard";
import { MutationRateLimitGuard } from "./auth/mutation-rate-limit.guard";
import { RateLimiter } from "./auth/rate-limit";
import { RolesGuard } from "./auth/roles.guard";
import { SessionGuard } from "./auth/session.guard";
import { DatabaseRepository } from "./database/database.repository";
import { HealthController } from "./health/health.controller";
import { HttpErrorFilter } from "./common/http-error.filter";

interface ApplicationOptions {
  database?: Pick<DatabaseRepository, "ping">;
  connectionString?: string;
  logger?: false;
  now?: () => number;
  allowedOrigins?: readonly string[];
  productionCookies?: boolean;
}

@Module({})
class ApplicationModule {
  static register(options: ApplicationOptions): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [HealthController, AuthController, AuthorizationController],
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
  http.set("trust proxy", false);
  http.disable("x-powered-by");
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("X-Request-Id", randomUUID());
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  return app;
}

function defaultOrigins(): string[] {
  const origins = ["http://127.0.0.1:3300"];
  const extra = process.env.WEB_ORIGIN;
  if (typeof extra === "string" && /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(extra) && !origins.includes(extra)) origins.push(extra);
  return origins;
}
