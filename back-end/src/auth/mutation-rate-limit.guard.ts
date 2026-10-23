import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "./api.exception";
import type { Actor } from "./auth.service";
import { isLogin } from "./csrf.guard";
import { RateLimiter } from "./rate-limit";

@Injectable()
export class MutationRateLimitGuard implements CanActivate {
  constructor(private readonly limits: RateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { actor?: Actor }>();
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS" || isLogin(request) || !request.actor) {
      return true;
    }
    try {
      this.limits.consume("mutation", request.actor.userId);
    } catch (error) {
      if (error instanceof Error && error.message === "LIMITE_EXCEDIDO") throw new ApiException(429, "LIMITE_EXCEDIDO");
      throw error;
    }
    return true;
  }
}
