import { ImageResponse } from "next/og";

export const alt = "Arremate — leilões simulados de arte de acervo público";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#F6F3EC", color: "#6E1E2B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 120, borderRadius: 20, background: "#6E1E2B", color: "#F6F3EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 88, fontWeight: 700 }}>A</div>
          <div style={{ fontSize: 96, fontWeight: 700 }}>Arremate</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, color: "#3a2a22" }}>Leilões simulados de arte de acervo público</div>
        <div style={{ marginTop: 16, fontSize: 28, color: "#A9823A" }}>Demonstração · valores simulados</div>
      </div>
    ),
    size,
  );
}
