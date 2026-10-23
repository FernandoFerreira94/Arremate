import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Request, Response } from "express";
import { Type } from "class-transformer";
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { RateLimiter } from "../auth/rate-limit";
import { Roles } from "../auth/roles.guard";
import { CatalogService, CATALOG_MAX_WINDOW, CATALOG_PAGE_SIZE, type CatalogItemView, type CatalogPage } from "./catalog.service";
import { MediaStore } from "./image-importer";

export class CatalogSearchQuery {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  q!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CATALOG_MAX_WINDOW / CATALOG_PAGE_SIZE)
  page: number = 1;
}

@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly limits: RateLimiter,
    private readonly media: MediaStore,
  ) {}

  @Get("catalog/search")
  @Roles("AUCTIONEER")
  search(@Query() query: CatalogSearchQuery, @Req() request: Request & { actor?: Actor }): Promise<CatalogPage> {
    this.consume(request);
    return this.catalog.search(query.q.trim(), query.page);
  }

  @Get("catalog/items/:externalId")
  @Roles("AUCTIONEER")
  item(@Param("externalId") externalId: string, @Req() request: Request & { actor?: Actor }): Promise<CatalogItemView> {
    this.consume(request);
    return this.catalog.getItem(externalId);
  }

  @Get("media/:key")
  async file(@Param("key") key: string, @Res() response: Response): Promise<void> {
    const path = this.media.pathFor(key);
    const type = MediaStore.typeFor(key);
    if (!path || !type) throw new ApiException(404, "NAO_ENCONTRADO");
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new ApiException(404, "NAO_ENCONTRADO");
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Length", String(info.size));
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(path);
      stream.on("error", reject);
      stream.on("end", () => resolve());
      stream.pipe(response);
    });
  }

  private consume(request: Request & { actor?: Actor }): void {
    if (!request.actor) throw new ApiException(401, "SESSAO_NECESSARIA");
    try {
      this.limits.consume("catalog", request.actor.userId);
    } catch (error) {
      if (error instanceof Error && error.message === "LIMITE_EXCEDIDO") throw new ApiException(429, "LIMITE_EXCEDIDO");
      throw error;
    }
  }
}
