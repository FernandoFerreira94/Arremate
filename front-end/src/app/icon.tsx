import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#6E1E2B", color: "#F6F3EC", fontSize: 44, fontWeight: 700, borderRadius: 10 }}>A</div>
    ),
    size,
  );
}
