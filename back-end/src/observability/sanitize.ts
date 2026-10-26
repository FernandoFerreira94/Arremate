/** Remove dados sensíveis antes de qualquer registro: e-mails, tokens, query string e números longos. */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER = /\b(bearer|token|senha|password|secret|cookie|csrf)\b\s*[:=]?\s*\S+/gi;
const LONG_HEX = /\b[0-9a-f]{32,}\b/gi;
const LONG_DIGITS = /\b\d{12,}\b/g;

export function sanitizeText(value: unknown, max = 500): string {
  const text = typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
  return text.replace(EMAIL, "[email]").replace(BEARER, "$1 [removido]").replace(LONG_HEX, "[hex]").replace(LONG_DIGITS, "[num]").slice(0, max);
}

/** Caminho sem query nem fragmento. */
export function sanitizePath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const path = value.split(/[?#]/)[0] ?? "";
  return sanitizeText(path, 200);
}

/** URL só com origem e caminho. */
export function sanitizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    return sanitizeText(`${url.origin}${url.pathname}`, 300);
  } catch {
    return sanitizePath(value);
  }
}

export function sanitizeStack(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return sanitizeText(value.split("\n").slice(0, 12).join("\n"), 2000);
}
