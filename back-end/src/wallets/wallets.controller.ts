import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { Roles } from "../auth/roles.guard";
import { DepositDto, TestCardDto } from "./dto/deposit.dto";
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

  @Get("cards")
  @Roles("BIDDER")
  cards(@Req() request: ActorRequest) { return this.wallets.cards(actorOf(request)); }

  @Post("cards")
  @Roles("BIDDER")
  saveCard(@Body() _body: TestCardDto, @Req() request: ActorRequest) { return this.wallets.saveTestCard(actorOf(request)); }

  @Delete("cards/:id")
  @Roles("BIDDER")
  @HttpCode(204)
  removeCard(@Param("id", new ParseUUIDPipe()) id: string, @Req() request: ActorRequest) { return this.wallets.removeCard(actorOf(request), id); }

  @Get("entries")
  @Roles("BIDDER")
  entries(@Query("page") page: string | undefined, @Query("filter") filter: string | undefined, @Req() request: ActorRequest) { return this.wallets.entries(actorOf(request), page, filter); }

  @Post("deposits")
  @Roles("BIDDER")
  @HttpCode(200)
  deposit(@Body() body: DepositDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest): Promise<WalletView> {
    return this.wallets.deposit(actorOf(request), body.amountCents, key, body.method, body.cardId);
  }
}

function actorOf(request: ActorRequest): Actor {
  if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
  return request.actor;
}
