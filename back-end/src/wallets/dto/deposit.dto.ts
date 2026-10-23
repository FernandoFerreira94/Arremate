import { IsString, MaxLength } from "class-validator";

export class DepositDto {
  @IsString()
  @MaxLength(20)
  amountCents!: string;
}
