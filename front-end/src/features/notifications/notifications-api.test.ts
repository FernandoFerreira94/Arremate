import { describe, expect, it } from "vitest";
import { badgeLabel, countdownParts, notificationLabel, toastable, toastKey, wrapIndex, type NotificationItem } from "./notifications-api";

const item = (id: string, lotId: string, readAt: string | null = null): NotificationItem => ({
  id, kind: "LOT_OPENED", lotId, title: "Obra", imageUrl: "/x.jpg", initialCents: "100", createdAt: "2026-10-25T12:00:00Z", readAt,
});

describe("notificações", () => {
  it("badge some em 0 e vira 9+ acima de 9", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(12)).toBe("9+");
  });
  it("toast só para novas desde a primeira leitura, não lidas e fora da sala do lote", () => {
    const items = [item("a", "L1"), item("b", "L2"), item("c", "L3", "2026-10-25T12:01:00Z"), item("d", "L4")];
    expect(toastable(null, items, "/")).toEqual([]);
    expect(toastable(new Set([toastKey(items[0])]), items, "/lotes/L4").map((i) => i.id)).toEqual(["b"]);
    // Superado de novo no mesmo lote: mesma linha, createdAt novo, toast de novo.
    const again = { ...items[0], createdAt: "2026-10-25T13:00:00Z" };
    expect(toastable(new Set([toastKey(items[0])]), [again], "/").map((i) => i.id)).toEqual(["a"]);
  });
  it("contagem em h/min/s", () => {
    expect(countdownParts((1 * 3600 + 48 * 60 + 22) * 1000)).toEqual({ h: "01", m: "48", s: "22" });
    expect(countdownParts(-5)).toEqual({ h: "00", m: "00", s: "00" });
  });
  it("índice do carrossel é circular", () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(2, 0)).toBe(0);
  });
});

describe("notificationLabel (QA MÉDIA 5)", () => {
  it("diferencia superado de lote aberto", () => {
    expect(notificationLabel("OUTBID")).toBe("Você foi superado");
    expect(notificationLabel("LOT_OPENED")).toBe("Lote abriu");
  });
});
