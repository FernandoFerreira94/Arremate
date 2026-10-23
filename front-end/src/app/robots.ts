import type { MetadataRoute } from "next";

/** Não bloqueia crawler: ele precisa ler o noindex das páginas. Sem sitemap enquanto nada é indexável. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }] };
}
