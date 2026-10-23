import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#6E1E2B", color: "#F6F3EC", fontSize: 126, fontWeight: 700, borderRadius: 30 }}>A</div>
    ),
    size,
  );
}
