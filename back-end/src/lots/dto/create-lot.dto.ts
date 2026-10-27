import { Type } from "class-transformer";
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";
import { SHOWCASE_STATES, type ShowcaseState } from "../lots.repository";

export class CreateLotDto {
  @IsString()
  @Matches(/^[1-9][0-9]{0,9}$/)
  externalId!: string;

  @IsString()
  @MaxLength(20)
  initialCents!: string;

  @IsString()
  @MaxLength(20)
  incrementCents!: string;

  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt!: string;

  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  endsAt!: string;
}

export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

/** Vitrine: página + busca opcional por nome da obra ou do artista. */
export class ShowcaseQuery extends PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Aba da vitrine filtrada no SQL; sem ela, todos os não cancelados. */
  @IsOptional()
  @IsIn(SHOWCASE_STATES)
  state?: ShowcaseState;
}

/** Participações do licitante; `lotId` opcional filtra a um lote (auditoria item 12). */
export class ParticipationsQuery extends PageQuery {
  @IsOptional()
  @IsUUID()
  lotId?: string;
}
