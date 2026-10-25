import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { Roles } from "../auth/roles.guard";
import { Authenticated } from "../auth/session.guard";
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

  /** D22 (H2): próximo leilão agendado, público. */
  @Get("lots/next")
  next() {
    return this.lots.nextScheduled();
  }

  /** D22 (H2b): até 5 agendados para o carrossel do hero, público. */
  @Get("lots/upcoming")
  upcoming(@Query("limit") limit?: string) {
    return this.lots.upcoming(limit);
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

  /** D22 (R12): id do usuário para a chave local do tour (arremate.tour.v1.<id>). TODO(integração Codex): mover para /auth/me. */
  @Get("me/id")
  @Authenticated()
  me(@Req() request: ActorRequest) {
    return { userId: actorOf(request).userId };
  }

  @Get("me/favorites")
  @Authenticated()
  favorites(@Req() request: ActorRequest) {
    return this.lots.favorites(actorOf(request));
  }

  @Put("lots/:id/favorite")
  @Authenticated()
  @HttpCode(200)
  favorite(@Param("id") id: string, @Req() request: ActorRequest) {
    return this.lots.setFavorite(actorOf(request), id, true);
  }

  @Delete("lots/:id/favorite")
  @Authenticated()
  @HttpCode(200)
  unfavorite(@Param("id") id: string, @Req() request: ActorRequest) {
    return this.lots.setFavorite(actorOf(request), id, false);
  }

  @Get("me/watches")
  @Authenticated()
  watches(@Req() request: ActorRequest) {
    return this.lots.watches(actorOf(request));
  }

  @Put("lots/:id/watch")
  @Authenticated()
  @HttpCode(200)
  watch(@Param("id") id: string, @Req() request: ActorRequest) {
    return this.lots.setWatch(actorOf(request), id, true);
  }

  @Delete("lots/:id/watch")
  @Authenticated()
  @HttpCode(200)
  unwatch(@Param("id") id: string, @Req() request: ActorRequest) {
    return this.lots.setWatch(actorOf(request), id, false);
  }

  @Get("me/notifications")
  @Authenticated()
  notifications(@Req() request: ActorRequest) {
    return this.lots.notifications(actorOf(request));
  }

  @Post("me/notifications/read-all")
  @Authenticated()
  @HttpCode(200)
  readAll(@Req() request: ActorRequest) {
    return this.lots.markRead(actorOf(request), null);
  }

  @Post("me/notifications/:id/read")
  @Authenticated()
  @HttpCode(200)
  read(@Param("id") id: string, @Req() request: ActorRequest) {
    return this.lots.markRead(actorOf(request), id);
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
