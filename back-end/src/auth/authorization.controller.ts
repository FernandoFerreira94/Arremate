import { Body, Controller, HttpException, Post } from "@nestjs/common";
import { RejectExtraDto } from "./dto/login.dto";
import { Roles } from "./roles.guard";

@Controller()
export class AuthorizationController {
  @Post("wallet/deposits")
  @Roles("BIDDER")
  deposit(@Body() _body: RejectExtraDto): never {
    throw unavailable();
  }

  @Post("lots/:id/bids")
  @Roles("BIDDER")
  bid(@Body() _body: RejectExtraDto): never {
    throw unavailable();
  }
}

function unavailable(): HttpException {
  return new HttpException({ code: "INDISPONIVEL" }, 501);
}
