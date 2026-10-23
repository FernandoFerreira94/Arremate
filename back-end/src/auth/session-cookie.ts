import type { CookieOptions } from "express";

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function sessionCookie(production: boolean): { name: string; options: CookieOptions } {
  return { name: production ? "__Host-session" : "session", options: baseOptions(production) };
}

export function csrfCookie(production: boolean): { name: string; options: CookieOptions } {
  return { name: production ? "__Host-csrf" : "csrf", options: baseOptions(production) };
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function clientIp(request: { socket: { remoteAddress?: string | null }; headers?: unknown }): string {
  const raw = request.socket.remoteAddress ?? "";
  if (raw.startsWith("::ffff:")) return raw.slice("::ffff:".length);
  return raw || "desconhecido";
}

function baseOptions(production: boolean): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: production, path: "/", maxAge: EIGHT_HOURS_MS };
}
