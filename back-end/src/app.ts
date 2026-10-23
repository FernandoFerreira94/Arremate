import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Module, ValidationPipe } from "@nestjs/common";
import type { DynamicModule, INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { DatabaseRepository } from "./database/database.repository";
import { HealthController } from "./health/health.controller";
import { HttpErrorFilter } from "./common/http-error.filter";

interface ApplicationOptions {
  database?: Pick<DatabaseRepository, "ping">;
  connectionString?: string;
  logger?: false;
}

@Module({})
class ApplicationModule {
  static register(options: ApplicationOptions): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [HealthController],
      providers: [{
        provide: DatabaseRepository,
        useFactory: () => {
          if (options.database) return options.database;
          const connectionString = options.connectionString ?? process.env.DATABASE_URL;
          if (!connectionString) throw new Error("Configure DATABASE_URL antes de iniciar a API.");
          return new DatabaseRepository(connectionString);
        },
      }],
    };
  }
}

export async function createApplication(options: ApplicationOptions = {}): Promise<INestApplication> {
  const app = await NestFactory.create(ApplicationModule.register(options), { logger: options.logger, abortOnError: false });
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
