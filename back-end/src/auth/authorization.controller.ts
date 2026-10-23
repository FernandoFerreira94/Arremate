import { Body, Controller, HttpException, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService, type Actor } from "./auth.service";
import { RejectExtraDto } from "./dto/login.dto";
import { Roles } from "./roles.guard";

@Controller()
export class AuthorizationController {
  constructor(private readonly auth: AuthService) {}

  @Post("wallet/deposits")
  @Roles("BIDDER")
  deposit(@Body() _body: RejectExtraDto): never {
    throw unavailable();
  }

  @Post("lots")
  @Roles("AUCTIONEER")
  create(@Body() _body: RejectExtraDto): never {
    throw unavailable();
  }

  @Post("lots/:id/bids")
  @Roles("BIDDER")
  bid(@Body() _body: RejectExtraDto): never {
    throw unavailable();
  }

  @Post("lots/:id/cancel")
  @Roles("AUCTIONEER")
  async cancel(@Param("id") id: string, @Body() _body: RejectExtraDto, @Req() request: Request & { actor?: Actor }): Promise<never> {
    if (!request.actor) throw new HttpException({ code: "SESSAO_NECESSARIA" }, 401);
    await this.auth.assertOwnLot(request.actor, id);
    throw unavailable();
  }
}

function unavailable(): HttpException {
  return new HttpException({ code: "INDISPONIVEL" }, 501);
}
