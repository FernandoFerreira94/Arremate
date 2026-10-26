import { ApiError } from "../../lib/api-error";
import { apiFetch } from "../../lib/api";

export type Role = "AUCTIONEER" | "BIDDER";
export type PublicSession = { role: Role; returnTo: string };
export type Session = { role: Role; userId: string; name: string };

export async function register(input: { name: string; email: string; password: string; termsAccepted: true }): Promise<PublicSession> {
  const body = await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
  if (!isPublicSession(body)) throw new ApiError({ statusCode: 0, code: "ERRO_INTERNO", message: "Não foi possível criar a conta.", requestId: "" });
  return body;
}

export async function login(input: { email: string; password: string; returnTo?: string }): Promise<PublicSession> {
  const body = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
  if (!isPublicSession(body)) {
    throw new ApiError({ statusCode: 0, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "" });
  }
  return body;
}

export function logout(): Promise<void> {
  return apiFetch("/api/auth/logout", { method: "POST" }).then(() => undefined);
}

export async function currentSession(): Promise<Session | null> {
  try {
    const body = await apiFetch("/api/auth/me");
    if (isRoleBody(body) && "userId" in body && typeof body.userId === "string" && "name" in body && typeof body.name === "string") return { role: body.role, userId: body.userId, name: body.name };
    throw new ApiError({ statusCode: 0, code: "ERRO_INTERNO", message: "Não foi possível concluir a operação.", requestId: "" });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) return null;
    throw error;
  }
}

function isPublicSession(body: unknown): body is PublicSession {
  return isRoleBody(body) && "returnTo" in body && typeof body.returnTo === "string" && body.returnTo.startsWith("/");
}

function isRoleBody(body: unknown): body is { role: Role } {
  return typeof body === "object" && body !== null && "role" in body && (body.role === "AUCTIONEER" || body.role === "BIDDER");
}
