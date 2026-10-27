import type { MetadataRoute } from "next";

/** PWA: instalável no desktop e no celular. Cores da marca (D12); o service worker fica em public/sw.js. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Arremate — leilões de arte (demonstração)",
    short_name: "Arremate",
    description: "Leilões de arte de acervo público com lances ao vivo e valores simulados.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F6F3EC",
    theme_color: "#6E1E2B",
    categories: ["shopping", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ao vivo", url: "/?aba=ao-vivo" },
      { name: "Carteira", url: "/carteira" },
      { name: "Meus arremates", url: "/meus-arremates" },
    ],
  };
}
