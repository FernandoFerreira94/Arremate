import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiException } from "./api.exception";
import type { Actor } from "./auth.service";
import type { Role } from "./return-to";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<readonly Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<{ actor?: Actor }>();
    if (!request.actor || !roles.includes(request.actor.role)) throw new ApiException(403, "ACESSO_NEGADO");
    return true;
  }
}
