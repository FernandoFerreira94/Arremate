import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class DepositDto {
  @IsString()
  @MaxLength(20)
  amountCents!: string;

  @IsOptional()
  @IsIn(["PIX", "CARD"])
  method?: "PIX" | "CARD";

  @IsOptional()
  @IsUUID()
  cardId?: string;
}

export class TestCardDto {}
