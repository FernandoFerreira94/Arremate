import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  returnTo?: string;
}

export class RejectExtraDto {
  @IsOptional()
  @IsString()
  @MaxLength(0)
  note?: string;
}
