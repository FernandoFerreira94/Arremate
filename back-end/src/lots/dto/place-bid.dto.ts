import { IsString, MaxLength } from "class-validator";

export class PlaceBidDto {
  @IsString()
  @MaxLength(20)
  amountCents!: string;
}
