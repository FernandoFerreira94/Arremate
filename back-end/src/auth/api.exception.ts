import { HttpException } from "@nestjs/common";

export class ApiException extends HttpException {
  constructor(status: number, code: string) {
    super({ code }, status);
  }
}
