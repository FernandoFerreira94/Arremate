import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { Roles } from "../auth/roles.guard";
import { Authenticated } from "../auth/session.guard";
import { RejectExtraDto } from "../auth/dto/login.dto";
import { bidMessage, SUCCESS_MESSAGES, withMessage } from "../common/messages";
import { BiddingService } from "./bidding.service";
import { CreateLotDto, PageQuery, ShowcaseQuery } from "./dto/create-lot.dto";
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
  showcase(@Query() query: ShowcaseQuery) {
    return this.lots.showcase(query.page, query.q, query.state);
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

  @Get("me/favorites")
  @Authenticated()
  favorites(@Req() request: ActorRequest) {
    return this.lots.favorites(actorOf(request));
  }

  @Put("lots/:id/favorite")
  @Authenticated()
  @HttpCode(200)
  async favorite(@Param("id") id: string, @Req() request: ActorRequest) {
    return withMessage(await this.lots.setFavorite(actorOf(request), id, true), SUCCESS_MESSAGES.FAVORITO_ADICIONADO);
  }

  @Delete("lots/:id/favorite")
  @Authenticated()
  @HttpCode(200)
  async unfavorite(@Param("id") id: string, @Req() request: ActorRequest) {
    return withMessage(await this.lots.setFavorite(actorOf(request), id, false), SUCCESS_MESSAGES.FAVORITO_REMOVIDO);
  }

  @Get("me/watches")
  @Authenticated()
  watches(@Req() request: ActorRequest) {
    return this.lots.watches(actorOf(request));
  }

  @Put("lots/:id/watch")
  @Authenticated()
  @HttpCode(200)
  async watch(@Param("id") id: string, @Req() request: ActorRequest) {
    return withMessage(await this.lots.setWatch(actorOf(request), id, true), SUCCESS_MESSAGES.AVISO_ATIVADO);
  }

  @Delete("lots/:id/watch")
  @Authenticated()
  @HttpCode(200)
  async unwatch(@Param("id") id: string, @Req() request: ActorRequest) {
    return withMessage(await this.lots.setWatch(actorOf(request), id, false), SUCCESS_MESSAGES.AVISO_DESATIVADO);
  }

  /** D32: lances de outras pessoas para o feed ao vivo (polling curto; o SSE é por lote e limitado por IP). */
  @Get("me/activity")
  @Authenticated()
  activity(@Query("after") after: string | undefined, @Req() request: ActorRequest) {
    return this.lots.activity(actorOf(request), after);
  }

  @Get("me/notifications")
  @Authenticated()
  notifications(@Req() request: ActorRequest) {
    return this.lots.notifications(actorOf(request));
  }

  @Post("me/notifications/read-all")
  @Authenticated()
  @HttpCode(200)
  async readAll(@Req() request: ActorRequest) {
    return withMessage(await this.lots.markRead(actorOf(request), null), SUCCESS_MESSAGES.NOTIFICACOES_LIDAS);
  }

  @Post("me/notifications/:id/read")
  @Authenticated()
  @HttpCode(200)
  async read(@Param("id") id: string, @Req() request: ActorRequest) {
    return withMessage(await this.lots.markRead(actorOf(request), id), SUCCESS_MESSAGES.NOTIFICACAO_LIDA);
  }

  @Post("lots")
  @Roles("AUCTIONEER")
  @HttpCode(201)
  async create(@Body() body: CreateLotDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest) {
    return withMessage(await this.lots.createLot(actorOf(request), body, key), SUCCESS_MESSAGES.LOTE_PUBLICADO);
  }

  @Post("lots/:id/bids")
  @Roles("BIDDER")
  @HttpCode(201)
  async bid(@Param("id") id: string, @Body() body: PlaceBidDto, @Headers("idempotency-key") key: string | undefined, @Req() request: ActorRequest) {
    const accepted = await this.bidding.placeBid(actorOf(request), id, body.amountCents, key);
    this.events.publish(id.toLowerCase());
    return withMessage(accepted, bidMessage(accepted.bid.amountCents));
  }

  @Post("lots/:id/cancel")
  @Roles("AUCTIONEER")
  @HttpCode(200)
  async cancel(@Param("id") id: string, @Body() _body: RejectExtraDto, @Req() request: ActorRequest) {
    const view = await this.lots.cancelLot(actorOf(request), id);
    this.events.publish(id.toLowerCase());
    return withMessage(view, SUCCESS_MESSAGES.LOTE_CANCELADO);
  }
}

function actorOf(request: ActorRequest): Actor {
  if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
  return request.actor;
}
