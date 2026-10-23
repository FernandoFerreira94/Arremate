const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;
const FORWARDED = ["cookie", "origin", "content-type", "accept", "x-csrf-token", "idempotency-key"];

export function apiProxyTarget(): string {
  const configured = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4300";
  if (!ORIGIN.test(configured)) return "http://127.0.0.1:4300";
  return configured;
}

export function upstreamHeaders(headers: Headers): Headers {
  const forwarded = new Headers();
  for (const name of FORWARDED) {
    const value = headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}
