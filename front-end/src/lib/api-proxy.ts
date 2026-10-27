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
  // D26 (M1): repassa só o IP do cliente (um valor), para a API contar limites por pessoa e não por 127.0.0.1.
  const ip = clientAddress(headers);
  if (ip) forwarded.set("x-forwarded-for", ip);
  return forwarded;
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f:.]{2,45}$/i;

/**
 * Auditoria item 10: usa o ÚLTIMO valor do X-Forwarded-For, o que o salto mais próximo acrescentou. O primeiro
 * vem do cliente e pode ser forjado. No deploy só o Caddy alcança o Next e ele troca o cabeçalho pelo IP real
 * (sem `trusted_proxies`); o Next só preenche o cabeçalho quando ele não veio. Inválido é descartado.
 */
export function clientAddress(headers: Headers): string | null {
  const last = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  if (IPV4.test(last) || (last.includes(":") && IPV6.test(last))) return last;
  return null;
}
