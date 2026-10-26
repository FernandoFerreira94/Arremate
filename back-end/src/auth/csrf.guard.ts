import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "./api.exception";
import { AuthService } from "./auth.service";
import { RateLimiter } from "./rate-limit";
import { clientIp } from "./session-cookie";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly limits: RateLimiter,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (isLogin(request)) {
      try {
        this.limits.consume("login", clientIp(request));
      } catch (error) {
        if (error instanceof Error && error.message === "LIMITE_EXCEDIDO") throw new ApiException(429, "LIMITE_EXCEDIDO");
        throw error;
      }
    }
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
    this.auth.assertCsrf(request);
    return true;
  }
}

export function isLogin(request: Request): boolean {
  if (request.method !== "POST") return false;
  const path = (request.originalUrl || request.url).split("?")[0] ?? "";
  return ["/api/auth/login", "/api/auth/register", "/api/auth/google/start"].includes(path);
}
