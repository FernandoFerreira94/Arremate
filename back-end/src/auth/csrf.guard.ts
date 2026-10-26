import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "./api.exception";
import { AuthService } from "./auth.service";
import { RateLimiter, type RateBucket } from "./rate-limit";
import { clientIp } from "./session-cookie";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly limits: RateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
    // A6: o relato de erro do navegador confere Origin no próprio controlador (sendBeacon não manda X-CSRF-Token).
    if (isClientErrorReport(request)) return true;
    this.auth.assertCsrf(request);
    // D26 (M1): o limite de login só conta depois de Origin e CSRF válidos, pelo IP real.
    if (isLogin(request)) consumeOrThrow(this.limits, "login", clientIp(request));
    return true;
  }
}

export function consumeOrThrow(limits: RateLimiter, bucket: RateBucket, key: string): void {
  try {
    limits.consume(bucket, key);
  } catch (error) {
    if (error instanceof Error && error.message === "LIMITE_EXCEDIDO") throw new ApiException(429, "LIMITE_EXCEDIDO");
    throw error;
  }
}

export function isClientErrorReport(request: Request): boolean {
  return request.method === "POST" && ((request.originalUrl || request.url).split("?")[0] ?? "") === "/api/client-errors";
}

export function isLogin(request: Request): boolean {
  if (request.method !== "POST") return false;
  const path = (request.originalUrl || request.url).split("?")[0] ?? "";
  return ["/api/auth/login", "/api/auth/register", "/api/auth/google/start"].includes(path);
}
