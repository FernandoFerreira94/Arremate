import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { ApiException } from "./api.exception";
import { AuthService } from "./auth.service";
import { GoogleRepository } from "./google.repository";
import { verifyGoogleIdToken } from "./google-token";
import { resolveReturnTo } from "./return-to";
import { readCookie, sessionCookie } from "./session-cookie";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };
export type GoogleFetch = typeof fetch;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function googleConfig(origins: readonly string[], production: boolean): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    if (!origins.includes(url.origin) || url.pathname !== "/api/auth/google/callback" || url.search || url.hash || url.username || url.password || (production && url.protocol !== "https:")) return null;
  } catch { return null; }
  return { clientId, clientSecret, redirectUri };
}

export class GoogleService {
  constructor(private readonly repository: GoogleRepository, private readonly auth: AuthService, private readonly config: GoogleConfig | null, private readonly production: boolean, private readonly request: GoogleFetch = fetch) {}
  get available(): boolean { return this.config !== null; }
  private cookie() { return { ...sessionCookie(this.production), name: this.production ? "__Host-google" : "google", options: { ...sessionCookie(this.production).options, maxAge: 600000 } }; }

  async start(request: Request, response: Response, returnTo?: string): Promise<{ url: string }> {
    if (!this.config) throw new ApiException(503,"GOOGLE_INDISPONIVEL");
    if (returnTo !== undefined && !resolveReturnTo(returnTo,"BIDDER").ok) throw new ApiException(400,"REQUISICAO_INVALIDA");
    const sessionToken = readCookie(request.headers.cookie, sessionCookie(this.production).name);
    const actor = sessionToken ? await this.auth.requireActor(request) : null;
    const state = randomBytes(32).toString("base64url");
    const browser = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    await this.repository.start({ state_hash: digest(state), browser_hash: digest(browser), code_verifier: verifier, nonce, return_to: returnTo ?? null, user_id: actor?.userId ?? null, session_hash: sessionToken ? digest(sessionToken) : null });
    const cookie = this.cookie();
    response.cookie(cookie.name,browser,cookie.options);
    const params = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: this.config.redirectUri, response_type: "code", scope: "openid email profile", state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  async callback(request: Request, response: Response): Promise<string> {
    const cookie = this.cookie();
    const browser = readCookie(request.headers.cookie,cookie.name);
    response.cookie(cookie.name,"",{ ...cookie.options,maxAge: 0 });
    const state = request.query.state;
    if (!this.config || typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state) || !browser) throw new ApiException(400,"GOOGLE_RECUSADO");
    const saved = await this.repository.consume(digest(state),digest(browser));
    if (!saved) throw new ApiException(400,"GOOGLE_RECUSADO");
    const code = request.query.code;
    if (request.query.error || typeof code !== "string" || code.length < 1 || code.length > 4096) throw new ApiException(400,"GOOGLE_RECUSADO");
    if (saved.user_id) {
      const actor = await this.auth.requireActor(request);
      const token = readCookie(request.headers.cookie,sessionCookie(this.production).name);
      if (actor.userId !== saved.user_id || !token || digest(token) !== saved.session_hash) throw new ApiException(400,"GOOGLE_RECUSADO");
    } else if (readCookie(request.headers.cookie,sessionCookie(this.production).name)) {
      throw new ApiException(400,"GOOGLE_RECUSADO");
    }
    const result = await this.request("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: this.config.clientId, client_secret: this.config.clientSecret, redirect_uri: this.config.redirectUri, grant_type: "authorization_code", code_verifier: saved.code_verifier }), signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!result.ok) throw new ApiException(400,"GOOGLE_RECUSADO");
    const tokens: unknown = await result.json();
    if (!tokens || typeof tokens !== "object" || !("id_token" in tokens) || typeof tokens.id_token !== "string") throw new ApiException(400,"GOOGLE_RECUSADO");
    const keys = await this.request("https://www.googleapis.com/oauth2/v3/certs", { signal: AbortSignal.timeout(8000), redirect: "error" });
    if (!keys.ok) throw new ApiException(400,"GOOGLE_RECUSADO");
    const identity = verifyGoogleIdToken(tokens.id_token,await keys.json(),this.config.clientId,saved.nonce);
    const user = await this.repository.identity(identity,saved.user_id);
    const destination = resolveReturnTo(saved.return_to ?? (saved.user_id ? "/perfil" : undefined),user.role);
    if (!destination.ok) throw new ApiException(400,"GOOGLE_RECUSADO");
    await this.auth.establishSession(user.id,user.role,destination.path,response);
    return destination.path;
  }
}
