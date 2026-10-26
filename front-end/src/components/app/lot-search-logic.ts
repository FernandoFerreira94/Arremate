/** Limite igual ao do back-end (`ShowcaseQuery.q`). */
export const SEARCH_MAX = 80;

/** Monta a URL da vitrine para uma busca: mantém a aba atual quando já está na vitrine e volta para a página 1. */
export function searchHref(term: string, current: URLSearchParams, onShowcase: boolean): string {
  const search = new URLSearchParams(onShowcase ? current.toString() : "");
  const q = term.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX);
  if (q) search.set("q", q);
  else search.delete("q");
  search.delete("page");
  const query = search.toString();
  return query ? `/?${query}` : "/";
}
