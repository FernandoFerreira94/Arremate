export type ApiFailure = {
  statusCode: number;
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, string>;
};

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string;
  readonly details?: Record<string, string>;

  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = "ApiError";
    this.statusCode = failure.statusCode;
    this.code = failure.code;
    this.requestId = failure.requestId;
    this.details = failure.details;
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  if (!isRecord(body)) {
    return new ApiError({ statusCode: status, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "" });
  }
  if (typeof body.statusCode === "number" && typeof body.code === "string" && typeof body.message === "string" && typeof body.requestId === "string") {
    return new ApiError({
      statusCode: body.statusCode,
      code: body.code,
      message: body.message,
      requestId: body.requestId,
      details: stringDetails(body.details),
    });
  }
  return new ApiError({ statusCode: status, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringDetails(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const details: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") details[key] = item;
  }
  return Object.keys(details).length > 0 ? details : undefined;
}
