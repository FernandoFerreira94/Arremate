import { Body, Controller, Get, Headers, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { Roles } from "../auth/roles.guard";
import { DepositDto } from "./dto/deposit.dto";
import { WalletsService } from "./wallets.service";
import type { WalletView } from "./wallets.types";

type ActorRequest = Request & { actor?: Actor };

@Controller("wallet")
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get()
  @Roles("BIDDER")
  get(@Req() request: ActorRequest): Promise<WalletView> {
    return this.wallets.getWallet(actorOf(request));
  }

  @Post("deposits")
  @Roles("BIDDER")
  @HttpCode(200)
  deposit(@Body() body: DepositDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest): Promise<WalletView> {
    return this.wallets.deposit(actorOf(request), body.amountCents, key);
  }
}

function actorOf(request: ActorRequest): Actor {
  if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
  return request.actor;
}
