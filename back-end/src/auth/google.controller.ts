import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { IsOptional, IsString, MaxLength } from "class-validator";
import type { Request, Response } from "express";
import { GoogleService } from "./google.service";

class GoogleStartDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  returnTo?: string;
}

@Controller("auth/google")
export class GoogleController {
  constructor(private readonly google: GoogleService) {}
  @Get("status")
  status() { return { available: this.google.available }; }
  @Post("start")
  start(@Body() input: GoogleStartDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { return this.google.start(request,response,input.returnTo); }
  @Get("callback")
  async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    try { response.redirect(303,await this.google.callback(request,response)); }
    catch { response.redirect(303,"/entrar?google=erro"); }
  }
}
