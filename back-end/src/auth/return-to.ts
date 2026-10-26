export type Role = "AUCTIONEER" | "BIDDER";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT = /^\/comprovantes\/[A-Za-z0-9_-]{20,128}$/;
const STATIC_PATHS = new Set([
  "/",
  "/entrar",
  "/perfil",
  "/suporte",
  "/favoritos",
  "/termos",
  "/privacidade",
  "/como-funciona",
  "/painel/lotes",
  "/painel/lotes/novo",
  "/carteira",
  "/meus-arremates",
]);

export function resolveReturnTo(value: string | undefined, role: Role): { ok: true; path: string } | { ok: false } {
  if (value === undefined) return { ok: true, path: role === "AUCTIONEER" ? "/painel/lotes" : "/" };
  if (!isAllowedPath(value)) return { ok: false };
  return { ok: true, path: value };
}

function isAllowedPath(value: string): boolean {
  if (value.length === 0 || value.length > 200) return false;
  if (value !== value.trim()) return false;
  if (hasControl(value) || value.includes("\\")) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("//") || value.includes("://") || value.includes("@") || value.includes("%")) return false;
  if (value.includes("?") || value.includes("#") || value.includes("..")) return false;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return false;
  }
  if (decoded !== value) return false;
  if (STATIC_PATHS.has(value)) return true;
  const lot = /^\/lotes\/([^/]+)$/.exec(value);
  if (lot?.[1] && UUID.test(lot[1])) return true;
  const audit = /^\/lotes\/([^/]+)\/auditoria$/.exec(value);
  if (audit?.[1] && UUID.test(audit[1])) return true;
  return RECEIPT.test(value);
}

function hasControl(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}
