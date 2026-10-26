import { NextResponse, type NextRequest } from "next/server";
import { fetchPublicLotMeta } from "./lib/public-lot";
import { buildCsp, createNonce } from "./lib/security-headers";

function withCsp(request: NextRequest, init: { status?: number; headers?: Record<string, string> } = {}) {
  // D26 (M2): nonce novo por requisição; o layout lê x-nonce para o script inline de entrada.
  const nonce = createNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ status: init.status, headers: init.headers, request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

function missing(request: NextRequest) {
  return withCsp(request, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/** O status precisa ser decidido antes de loading.tsx iniciar o streaming. Só consulta pública, sem credenciais. */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const lot = /^\/lotes\/([^/]+)(?:\/auditoria)?$/.exec(pathname);
  if (lot && !(await fetchPublicLotMeta(lot[1]))) return missing(request);
  const receipt = /^\/comprovantes\/([^/]+)$/.exec(pathname);
  if (receipt && !/^[A-Za-z0-9_-]{32}$/.test(receipt[1])) return missing(request);
  return withCsp(request);
}

// D26: todas as páginas (para a CSP), menos /api, estáticos e imagens otimizadas.
export const config = {
  matcher: [{ source: "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }],
};
