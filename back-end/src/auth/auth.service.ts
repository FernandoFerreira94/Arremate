import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { ApiException } from "./api.exception";
import { AuthRepository } from "./auth.repository";
import { csrfTokenForSession, safeEqual } from "./csrf-token";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password-hash";
import { resolveReturnTo, type Role } from "./return-to";
import { csrfCookie, readCookie, sessionCookie } from "./session-cookie";

export type Actor = { userId: string; role: Role; name?: string };
export type PublicSession = { role: Role; returnTo: string };

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly allowedOrigins: readonly string[],
    private readonly productionCookies: boolean,
  ) {}

  issueCsrf(request: Request, response: Response): { csrfToken: string } {
    const sessionToken = this.sessionToken(request);
    if (sessionToken) return { csrfToken: csrfTokenForSession(sessionToken) };
    const csrf = csrfCookie(this.productionCookies);
    let secret = readCookie(request.headers.cookie, csrf.name);
    if (!secret) {
      secret = randomBytes(32).toString("base64url");
      response.cookie(csrf.name, secret, csrf.options);
    }
    return { csrfToken: csrfTokenForSession(secret) };
  }

  assertCsrf(request: Request): void {
    const origin = request.header("origin");
    const header = request.header("x-csrf-token");
    if (!origin || !this.allowedOrigins.includes(origin) || !header) throw new ApiException(403, "CSRF_RECUSADO");
    const sessionToken = this.sessionToken(request);
    if (sessionToken && safeEqual(header, csrfTokenForSession(sessionToken))) return;
    const secret = readCookie(request.headers.cookie, csrfCookie(this.productionCookies).name);
    if (secret && safeEqual(header, csrfTokenForSession(secret))) return;
    throw new ApiException(403, "CSRF_RECUSADO");
  }

  async login(input: { email: string; password: string; returnTo?: string }, response: Response): Promise<PublicSession> {
    if (input.returnTo !== undefined && !resolveReturnTo(input.returnTo, "BIDDER").ok) {
      throw new ApiException(400, "REQUISICAO_INVALIDA");
    }
    const email = input.email.trim().toLowerCase();
    const user = await this.repository.findUserByEmail(email);
    const encoded = user?.passwordHash ?? await dummyPasswordHash();
    const matches = await verifyPassword(encoded, input.password);
    if (!user || !user.passwordHash || !matches) throw new ApiException(401, "CREDENCIAIS_INVALIDAS");
    const destination = resolveReturnTo(input.returnTo, user.role);
    if (!destination.ok) throw new ApiException(400, "REQUISICAO_INVALIDA");
    return this.establishSession(user.id, user.role, destination.path, response);
  }

  async register(input: { name: string; email: string; password: string }, response: Response): Promise<PublicSession> {
    const user = await this.repository.register(input.name.trim(), input.email.trim().toLowerCase(), await hashPassword(input.password));
    return this.establishSession(user.id, user.role, "/carteira?conta=criada", response);
  }

  async establishSession(userId: string, role: Role, returnTo: string, response: Response): Promise<PublicSession> {
    const token = randomBytes(32).toString("base64url");
    await this.repository.createSession(userId, createHash("sha256").update(token).digest("hex"));
    const session = sessionCookie(this.productionCookies);
    response.cookie(session.name, token, session.options);
    const csrf = csrfCookie(this.productionCookies);
    response.cookie(csrf.name, "", { ...csrf.options, maxAge: 0 });
    return { role, returnTo };
  }

  async requireActor(request: Request): Promise<Actor> {
    const token = this.sessionToken(request);
    if (!token) throw new ApiException(401, "SESSAO_NECESSARIA");
    const actor = await this.repository.findActiveSession(createHash("sha256").update(token).digest("hex"));
    if (!actor) throw new ApiException(401, "SESSAO_NECESSARIA");
    return actor;
  }

  async logout(request: Request, response: Response): Promise<void> {
    const token = this.sessionToken(request);
    if (!token) throw new ApiException(401, "SESSAO_NECESSARIA");
    const hash = createHash("sha256").update(token).digest("hex");
    const actor = await this.repository.findActiveSession(hash);
    if (!actor) throw new ApiException(401, "SESSAO_NECESSARIA");
    await this.repository.revokeSession(hash);
    const session = sessionCookie(this.productionCookies);
    const csrf = csrfCookie(this.productionCookies);
    response.cookie(session.name, "", { ...session.options, maxAge: 0 });
    response.cookie(csrf.name, "", { ...csrf.options, maxAge: 0 });
  }

  async assertOwnLot(actor: Actor, lotId: string): Promise<void> {
    const ownerId = await this.repository.findLotOwner(lotId);
    if (!ownerId || ownerId !== actor.userId) throw new ApiException(404, "NAO_ENCONTRADO");
  }

  private sessionToken(request: Request): string | null {
    return readCookie(request.headers.cookie, sessionCookie(this.productionCookies).name);
  }
}
