import { NextResponse } from "next/server";
import { apiProxyTarget, upstreamHeaders } from "@/lib/api-proxy";

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
  const target = new URL(`${apiProxyTarget()}/api/${path.map((part) => encodeURIComponent(part)).join("/")}`);
  target.search = new URL(request.url).search;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers: upstreamHeaders(request.headers),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
    // SSE: cliente fecha a aba, a conexão com a API fecha junto.
    signal: request.signal,
  });
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

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
