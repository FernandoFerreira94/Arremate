import type { NextConfig } from "next";
import { staticSecurityHeaders } from "./src/lib/security-headers";

// O E2E compila em pasta própria para não sobrescrever o build servido em 3300.
const nextConfig: NextConfig = { poweredByHeader: false,
 distDir: process.env.NEXT_DIST_DIR === ".next-e2e" ? ".next-e2e" : ".next",
  images: {
    localPatterns: [{ pathname: "/api/media/**", search: "" }],
    remotePatterns: [{ protocol: "https", hostname: "images.metmuseum.org", port: "", pathname: "/CRDImages/**", search: "" }],
    maximumRedirects: 0,
  },
  // D26 (M2): o proxy /api não repassa os cabeçalhos do helmet; estes valem para todas as rotas.
  async headers() {
    return [{ source: "/:path*", headers: staticSecurityHeaders(process.env.NODE_ENV === "production") }];
  } };

export default nextConfig;
