import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { SUCCESS_MESSAGES, withMessage } from "../common/messages";
import { ApiException } from "./api.exception";
import { AuthService, type Actor, type PublicSession } from "./auth.service";
import { Authenticated } from "./session.guard";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { consumeOrThrow } from "./csrf.guard";
import { RateLimiter } from "./rate-limit";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly limits: RateLimiter,
  ) {}

  @Get("csrf")
  csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response): { csrfToken: string } {
    return this.auth.issueCsrf(request, response);
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response): Promise<PublicSession & { message: string }> {
    // D26 (M1): limite por conta, além do limite por IP do CsrfGuard.
    consumeOrThrow(this.limits, "loginEmail", String(body.email ?? "").trim().toLowerCase());
    return withMessage(await this.auth.login(body, response), SUCCESS_MESSAGES.LOGIN);
  }

  @Post("register")
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response): Promise<PublicSession & { message: string }> {
    return withMessage(await this.auth.register(body, response), SUCCESS_MESSAGES.CADASTRO);
  }

  @Post("logout")
  @HttpCode(204)
  @Authenticated()
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request, response);
  }

  @Get("me")
  @Authenticated()
  me(@Req() request: Request & { actor?: Actor }): { role: Actor["role"]; userId: string; name: string } {
    if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
    return { role: request.actor.role, userId: request.actor.userId, name: displayName(request.actor.name, request.actor.role) };
  }
}

/** QA BAIXA 6: conta sem nome (as demo do seed) mostra o papel, não "Participante". */
export function displayName(name: string | null | undefined, role: Actor["role"]): string {
  const trimmed = name?.trim();
  // "Participante" é o default da coluna users.name: conta que nunca informou nome.
  if (trimmed && trimmed !== "Participante") return trimmed;
  return role === "AUCTIONEER" ? "Leiloeiro" : "Licitante";
}
