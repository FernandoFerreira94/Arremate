import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthService, type Actor } from "./auth.service";
import { ROLES_KEY } from "./roles.guard";

export const AUTH_KEY = "authenticated";
export const Authenticated = () => SetMetadata(AUTH_KEY, true);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const controller = context.getClass();
    const authenticated = this.reflector.getAllAndOverride<boolean>(AUTH_KEY, [handler, controller]);
    const roles = this.reflector.getAllAndOverride<readonly string[] | undefined>(ROLES_KEY, [handler, controller]);
    if (!authenticated && !roles) return true;
    const request = context.switchToHttp().getRequest<Request & { actor?: Actor }>();
    request.actor = await this.auth.requireActor(request);
    return true;
  }
}
