import { Body, Controller, Get, HttpCode, HttpException, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService, type Actor, type PublicSession } from "./auth.service";
import { Authenticated } from "./session.guard";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("csrf")
  csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response): { csrfToken: string } {
    return this.auth.issueCsrf(request, response);
  }

  @Post("login")
  @HttpCode(200)
  login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response): Promise<PublicSession> {
    return this.auth.login(body, response);
  }

  @Post("register")
  register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response): Promise<PublicSession> {
    return this.auth.register(body, response);
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
    if (!request.actor) throw new HttpException({ code: "SESSAO_NECESSARIA" }, 401);
    return { role: request.actor.role, userId: request.actor.userId, name: request.actor.name ?? "Participante" };
  }
}
