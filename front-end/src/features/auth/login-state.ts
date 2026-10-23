import { ApiError } from "../../lib/api-error";

export type LoginValues = { email: string; password: string };

export function afterLoginFailure(values: LoginValues, error: unknown): { values: LoginValues; message: string } {
  const kept = { email: values.email, password: "" };
  if (error instanceof ApiError) {
    if (error.statusCode === 401 || error.statusCode === 400) return { values: kept, message: "Email ou senha incorretos." };
    if (error.statusCode === 429) return { values: kept, message: "Muitas tentativas. Aguarde um pouco e tente de novo." };
    if (error.statusCode === 0) return { values: kept, message: "Sem conexão com o servidor. Tente de novo." };
  }
  return { values: kept, message: "Não foi possível entrar agora. Tente de novo." };
}

/** Só caminhos internos; o back revalida o destino por papel. */
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value;
}
