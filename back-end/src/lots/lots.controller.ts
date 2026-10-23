import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { Roles } from "../auth/roles.guard";
import { RejectExtraDto } from "../auth/dto/login.dto";
import { BiddingService } from "./bidding.service";
import { CreateLotDto, PageQuery } from "./dto/create-lot.dto";
import { PlaceBidDto } from "./dto/place-bid.dto";
import { LotEventsService } from "./lot-events.service";
import { LotsService } from "./lots.service";
import { SettlementService } from "./settlement.service";

type ActorRequest = Request & { actor?: Actor };

@Controller()
export class LotsController {
  constructor(
    private readonly lots: LotsService,
    private readonly bidding: BiddingService,
    private readonly settlement: SettlementService,
    private readonly events: LotEventsService,
  ) {}

  @Get("lots")
  showcase(@Query() query: PageQuery) {
    return this.lots.showcase(query.page);
  }

  @Get("lots/:id")
  detail(@Param("id") id: string) {
    return this.lots.detail(id);
  }

  @Get("lots/:id/audit")
  audit(@Param("id") id: string) {
    return this.lots.publicAudit(id);
  }

  @Get("lots/:id/bids")
  bids(@Param("id") id: string, @Query() query: PageQuery) {
    return this.lots.bids(id, query.page, query.limit);
  }

  @Get("seller/lots")
  @Roles("AUCTIONEER")
  seller(@Query() query: PageQuery, @Req() request: ActorRequest) {
    return this.lots.sellerLots(actorOf(request), query.page, query.limit);
  }

  @Get("seller/summary")
  @Roles("AUCTIONEER")
  sellerSummary(@Req() request: ActorRequest) {
    return this.settlement.getSellerSummary(actorOf(request));
  }

  @Get("me/participations")
  @Roles("BIDDER")
  participations(@Query() query: PageQuery, @Req() request: ActorRequest) {
    return this.settlement.listParticipations(actorOf(request), query.page);
  }

  @Get("me/awards")
  @Roles("BIDDER")
  awards(@Query() query: PageQuery, @Req() request: ActorRequest) {
    return this.settlement.listAwards(actorOf(request), query.page);
  }

  @Post("lots")
  @Roles("AUCTIONEER")
  @HttpCode(201)
  create(@Body() body: CreateLotDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest) {
    return this.lots.createLot(actorOf(request), body, key);
  }

  @Post("lots/:id/bids")
  @Roles("BIDDER")
  @HttpCode(201)
  async bid(@Param("id") id: string, @Body() body: PlaceBidDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest) {
    const accepted = await this.bidding.placeBid(actorOf(request), id, body.amountCents, key);
    this.events.publish(id.toLowerCase());
    return accepted;
  }

  @Post("lots/:id/cancel")
  @Roles("AUCTIONEER")
  @HttpCode(200)
  async cancel(@Param("id") id: string, @Body() _body: RejectExtraDto, @Req() request: ActorRequest) {
    const view = await this.lots.cancelLot(actorOf(request), id);
    this.events.publish(id.toLowerCase());
    return view;
  }
}

function actorOf(request: ActorRequest): Actor {
  if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
  return request.actor;
}
