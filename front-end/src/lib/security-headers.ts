/**
 * D26 (M2): cabeçalhos de segurança do front. A CSP usa nonce por requisição (gerado no proxy.ts);
 * o Next aplica o mesmo nonce nos próprios scripts ao ler a CSP da requisição.
 */
export function buildCsp(nonce: string, options: { dev: boolean }): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(options.dev ? ["'unsafe-eval'"] : [])];
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    // next/font e os estilos inline do React/Sonner; scripts continuam restritos ao nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // O início do Google redireciona para accounts.google.com.
    "form-action 'self' https://accounts.google.com",
    "object-src 'none'",
  ].join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Cabeçalhos fixos para todas as rotas (páginas, estáticos e /api). HSTS só em produção. */
export function staticSecurityHeaders(production: boolean): { key: string; value: string }[] {
  const headers = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
  if (production) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}
