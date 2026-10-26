import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { SiteFooter } from "@/components/app/site-footer";
import { SiteHeader } from "@/components/app/site-header";
import { siteUrl } from "@/lib/page-metadata";
import { BrandIntro, INTRO_BOOT_SCRIPT } from "@/components/app/brand-intro";
import { PageEntrance } from "@/components/app/page-entrance";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // D26 (M2): nonce da CSP gerado no proxy.ts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* O script estático só altera o atributo de entrada antes da hidratação. */}
        <script id="arremate-intro-boot" nonce={nonce} dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <BrandIntro />
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
          Pular para o conteúdo
        </a>
        <Providers>
          <SiteHeader />
          <main id="conteudo" className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-8 lg:px-10 lg:py-10">
            <PageEntrance>{children}</PageEntrance>
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
