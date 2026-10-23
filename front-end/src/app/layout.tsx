import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/app/site-footer";
import { SiteHeader } from "@/components/app/site-header";
import { siteUrl } from "@/lib/page-metadata";
import { Providers } from "./providers";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "Arremate",
  title: { default: "Arremate — demonstração", template: "%s · Arremate" },
  description: "Demonstração de leilões de arte de acervo público com valores simulados.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#6E1E2B", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
        <Providers>
          <SiteHeader />
          <main id="conteudo" className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 lg:px-10 lg:py-10">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
