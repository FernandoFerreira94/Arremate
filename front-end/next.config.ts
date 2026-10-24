import type { NextConfig } from "next";

// O E2E compila em pasta própria para não sobrescrever o build servido em 3300.
const nextConfig: NextConfig = { poweredByHeader: false, distDir: process.env.NEXT_DIST_DIR === ".next-e2e" ? ".next-e2e" : ".next" };

export default nextConfig;
