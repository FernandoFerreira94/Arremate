import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Request, Response } from "express";
import { Type } from "class-transformer";
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { ApiException } from "../auth/api.exception";
import type { Actor } from "../auth/auth.service";
import { RateLimiter } from "../auth/rate-limit";
import { Roles } from "../auth/roles.guard";
import { CatalogService, CATALOG_MAX_WINDOW, CATALOG_PAGE_SIZE, type CatalogItemView, type CatalogPage } from "./catalog.service";
import { MediaStore } from "./image-importer";

/** D28: a versão em alta do zoom pode ser trocada pelo script, então não é imutável. */
const ZOOM_CACHE = "public, max-age=3600";

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

  /**
   * D28: versão de zoom (~2500 px, gerada por scripts/zoom-hires.py a partir do original CC0 do Met) em <media>/zoom/<externalId>.jpg.
   * Sem o arquivo, entrega a mídia normal do snapshot da obra, para o zoom nunca ficar sem imagem.
   */
  @Get("media/zoom/:externalId")
  async zoom(@Param("externalId") externalId: string, @Res() response: Response): Promise<void> {
    if (!/^\d{1,10}$/.test(externalId)) throw new ApiException(404, "NAO_ENCONTRADO");
    const hires = join(this.media.root, "zoom", `${externalId}.jpg`);
    if ((await stat(hires).catch(() => null))?.isFile()) return this.send(hires, "image/jpeg", response, ZOOM_CACHE);
    const key = await this.catalog.snapshotMediaKey(externalId);
    if (!key) throw new ApiException(404, "NAO_ENCONTRADO");
    return this.serveMedia(key, response, ZOOM_CACHE);
  }

  @Get("media/:key")
  async file(@Param("key") key: string, @Res() response: Response): Promise<void> {
    return this.serveMedia(key, response);
  }

  /** QA ALTA 1: arquivo ausente neste checkout é restaurado do Met (mesmo sha256) antes de responder 404. */
  private async serveMedia(key: string, response: Response, cache?: string): Promise<void> {
    const path = this.media.pathFor(key);
    const type = MediaStore.typeFor(key);
    if (!path || !type) throw new ApiException(404, "NAO_ENCONTRADO");
    if (!(await stat(path).catch(() => null))?.isFile() && !(await this.catalog.restoreMedia(key))) throw new ApiException(404, "NAO_ENCONTRADO");
    return this.send(path, type, response, cache);
  }

  private async send(path: string, type: string, response: Response, cache = "public, max-age=31536000, immutable"): Promise<void> {
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new ApiException(404, "NAO_ENCONTRADO");
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Length", String(info.size));
    response.setHeader("Cache-Control", cache);
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
