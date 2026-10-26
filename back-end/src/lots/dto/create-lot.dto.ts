import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

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
}

