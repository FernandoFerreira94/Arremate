import type { Metadata } from "next";

const LOCAL = "http://127.0.0.1:3300";
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;

export function siteUrl(raw: string | undefined = process.env.SITE_URL): string {
  return typeof raw === "string" && ORIGIN.test(raw) ? raw : LOCAL;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Metadados por rota. Demo é noindex por padrão (indexação pública exige aprovação). Nunca recebe PII, saldo ou preço. */
export function pageMetadata(input: { title: string; description: string; path: string; base?: string }): Metadata {
  const base = input.base ?? siteUrl();
  const path = new URL(input.path, base).pathname;
  const url = `${base}${path}`;
  const title = clip(input.title, 70);
  const description = clip(input.description, 160);
  const social = title.includes("Arremate") ? title : `${title} · Arremate`;
  const image = { url: `${base}/opengraph-image`, width: 1200, height: 630, alt: "Arremate — leilões simulados de arte de acervo público" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: social, description, url, siteName: "Arremate", locale: "pt_BR", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: social, description, images: [image.url] },
    robots: { index: false, follow: false },
  };
}
