import { NextResponse, type NextRequest } from "next/server";
import { fetchPublicLotMeta } from "./lib/public-lot";

function missing() {
  return NextResponse.next({ status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

/** O status precisa ser decidido antes de loading.tsx iniciar o streaming. Só consulta pública, sem credenciais. */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const lot = /^\/lotes\/([^/]+)(?:\/auditoria)?$/.exec(pathname);
  if (lot && !(await fetchPublicLotMeta(lot[1]))) return missing();
  const receipt = /^\/comprovantes\/([^/]+)$/.exec(pathname);
  if (receipt && !/^[A-Za-z0-9_-]{32}$/.test(receipt[1])) return missing();
  return NextResponse.next();
}

export const config = { matcher: ["/lotes/:id", "/lotes/:id/auditoria", "/comprovantes/:token"] };
