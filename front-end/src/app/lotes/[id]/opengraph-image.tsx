import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { apiProxyTarget } from "@/lib/api-proxy";
import { fetchPublicLotMeta } from "@/lib/public-lot";

export const alt = "Obra de acervo público em leilão simulado no Arremate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function LotImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lot = await fetchPublicLotMeta(id);
  if (!lot) notFound();
  let artwork: string | null = null;
  if (lot.imageUrl?.startsWith("/demo/")) {
    // Modo demo: a imagem é arquivo estático do próprio front.
    try {
      artwork = "data:image/jpeg;base64," + (await readFile(join(process.cwd(), "public", lot.imageUrl))).toString("base64");
    } catch { /* sem imagem, o preview segue só com o título */ }
  } else if (lot.imageUrl) {
    try {
      const response = await fetch(apiProxyTarget() + lot.imageUrl, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (response.ok && ["image/jpeg", "image/png", "image/webp"].includes(response.headers.get("content-type")?.split(";")[0] ?? "")) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length <= 10 * 1024 * 1024) artwork = "data:" + response.headers.get("content-type")?.split(";")[0] + ";base64," + bytes.toString("base64");
      }
    } catch { /* A imagem ausente não impede o preview com título. */ }
  }
  const mark = "data:image/svg+xml;base64," + (await readFile(join(process.cwd(), "public/brand/l3-simbolo-paper.svg"))).toString("base64");
  const font = new Uint8Array(await readFile(join(process.cwd(), "public/fonts/fraunces-600.ttf"))).buffer;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#F6F3EC", color: "#1F1B16", padding: 50, gap: 50, fontFamily: "Fraunces" }}>
      {artwork ? (
        // ImageResponse precisa do elemento img para renderizar o bitmap incorporado.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork} alt="" width={480} height={530} style={{ objectFit: "contain" }} />
      ) : (
        <div style={{ width: 480, height: 530, background: "#6E1E2B", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Sem imagem da obra: símbolo L3 (martelo) no lugar. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renderiza o SVG pelo elemento img. */}
          <img src={mark} alt="" width={240} height={240} />
        </div>
      )}
      <div style={{ width: 570, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renderiza o SVG pelo elemento img. */}
          <img src={mark} alt="" width={44} height={44} />
          <div style={{ fontSize: 38, color: "#6E1E2B" }}>Arremate</div>
        </div>
        <div style={{ fontSize: 54, lineHeight: 1.1 }}>{lot.title.slice(0, 120)}</div>
        <div style={{ fontSize: 26, color: "#5C5448" }}>{lot.artist.slice(0, 100)}</div>
        <div style={{ fontSize: 22, color: "#6E1E2B" }}>Demonstração · valores simulados</div>
        <div style={{ fontSize: 18, color: "#5C5448" }}>The Met Open Access · CC0</div>
      </div>
    </div>,
    { ...size, fonts: [{ name: "Fraunces", data: font, style: "normal", weight: 600 }] },
  );
}
