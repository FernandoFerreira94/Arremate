import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Arremate — leilões simulados de arte de acervo público";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // Símbolo L3 (martelo) em papel sobre bordô, o mesmo arquivo de public/brand.
  const mark = "data:image/svg+xml;base64," + (await readFile(join(process.cwd(), "public/brand/l3-simbolo-paper.svg"))).toString("base64");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#F6F3EC", color: "#6E1E2B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renderiza o SVG pelo elemento img. */}
          <img src={mark} alt="" width={120} height={120} />
          <div style={{ fontSize: 96, fontWeight: 700 }}>Arremate</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, color: "#3a2a22" }}>Leilões simulados de arte de acervo público</div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#A9823A" }}>Demonstração · valores simulados</div>
      </div>
    ),
    size,
  );
}
