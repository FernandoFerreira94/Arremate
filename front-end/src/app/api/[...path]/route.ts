import { NextResponse } from "next/server";
import { DEMO_ARTWORKS, DEMO_MODE, demoImageUrl } from "@/demo/seed";
import { apiProxyTarget, upstreamHeaders, upstreamUnavailable } from "@/lib/api-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  if (path.length === 0 || path.some((part) => part.length === 0 || part === "." || part === ".." || part.includes("\\") || part.includes("/"))) {
    return NextResponse.json(
      { statusCode: 400, code: "REQUISICAO_INVALIDA", message: "Requisição inválida.", requestId: "" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (DEMO_MODE) return demoRoute(request, path);
  const target = new URL(`${apiProxyTarget()}/api/${path.map((part) => encodeURIComponent(part)).join("/")}`);
  target.search = new URL(request.url).search;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders(request.headers),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
      // SSE: cliente fecha a aba, a conexão com a API fecha junto.
      signal: request.signal,
    });
  } catch {
    return upstreamUnavailable();
  }
  const headers = new Headers();
  const location = upstream.headers.get("location");
  if (location) headers.set("location", location);
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", upstream.headers.get("cache-control") ?? "no-store");
  const requestId = upstream.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

/** Modo demo: as rotas de dados rodam no navegador; aqui sobram o zoom da obra (arquivo estático) e o relato de erro. */
async function demoRoute(request: Request, path: string[]): Promise<Response> {
  if (path[0] === "client-errors") return new NextResponse(null, { status: 204 });
  const externalId = path[0] === "media" && path[1] === "zoom" ? path[2] : undefined;
  if (externalId && DEMO_ARTWORKS.some((art) => art.externalId === externalId)) {
    const file = await fetch(new URL(demoImageUrl(externalId), request.url), { cache: "no-store" });
    if (file.ok) return new NextResponse(file.body, { status: 200, headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400" } });
  }
  return NextResponse.json({ statusCode: 404, code: "NAO_ENCONTRADO", message: "Recurso não encontrado.", requestId: "demo" }, { status: 404, headers: { "cache-control": "no-store" } });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
