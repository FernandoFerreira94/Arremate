import { createPublicKey, verify } from "node:crypto";

export type GoogleIdentity = { subject: string; email: string; name: string };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OIDC inválido");
  return value as Record<string, unknown>;
}

/** Somente JWKS do endpoint fixo do Google; nenhum jku/x5u vindo do JWT é usado. */
export function verifyGoogleIdToken(token: string, jwks: unknown, audience: string, nonce: string, now = Math.floor(Date.now()/1000)): GoogleIdentity {
  if (token.length > 16384) throw new Error("OIDC inválido");
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error("OIDC inválido");
  const header = object(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
  const claims = object(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
  const keys = object(jwks).keys;
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !Array.isArray(keys)) throw new Error("OIDC inválido");
  const key = keys.map(object).find(k => k.kid === header.kid && k.kty === "RSA" && (k.use === undefined || k.use === "sig") && (k.alg === undefined || k.alg === "RS256"));
  if (!key || typeof key.n !== "string" || typeof key.e !== "string") throw new Error("OIDC inválido");
  const publicKey = createPublicKey({ key: { kty: "RSA", n: key.n, e: key.e }, format: "jwk" });
  if (!verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], "base64url"))) throw new Error("OIDC inválido");
  const aud = claims.aud;
  const acceptedAudience = aud === audience || (Array.isArray(aud) && aud.includes(audience) && claims.azp === audience);
  if (!["accounts.google.com", "https://accounts.google.com"].includes(String(claims.iss)) || !acceptedAudience
    || (claims.azp !== undefined && claims.azp !== audience)
    || typeof claims.exp !== "number" || claims.exp <= now
    || typeof claims.iat !== "number" || claims.iat > now+60 || claims.iat > claims.exp
    || claims.nonce !== nonce || claims.email_verified !== true
    || typeof claims.sub !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(claims.sub)
    || typeof claims.email !== "string" || claims.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) throw new Error("OIDC inválido");
  return { subject: claims.sub, email: claims.email.trim().toLowerCase(), name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0,100) : "Participante" };
}
