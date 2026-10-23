import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa de Leilões — demonstração",
  description: "Ambiente de demonstração em preparação. Valores e leilões simulados.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
