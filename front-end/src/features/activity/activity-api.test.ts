import { describe, expect, it } from "vitest";
import { EMPTY_FEED, enqueue, FEED_QUEUE_MAX, promote, type ActivityItem } from "./activity-api";

const item = (id: string, lotId = "lote-1"): ActivityItem => ({ id, lotId, title: `Obra ${id}`, alias: "Licitante 2", amountCents: "10500", acceptedAt: "2026-10-26T18:00:00.000Z" });
const describeItem = (i: ActivityItem) => `Novo lance em ${i.title}`;

describe("feed de lances ao vivo (D32)", () => {
  it("ignora já vistos e o lote da sala aberta", () => {
    expect(enqueue([], new Set(["a"]), [item("a"), item("b"), item("c", "aberto")], "/lotes/aberto").map((i) => i.id)).toEqual(["b"]);
  });

  it("fila tem teto e descarta os mais antigos", () => {
    const many = Array.from({ length: FEED_QUEUE_MAX + 3 }, (_, n) => item(String(n)));
    const queue = enqueue([], new Set(), many, "/");
    expect(queue).toHaveLength(FEED_QUEUE_MAX);
    expect(queue[0]?.id).toBe("3");
  });

  it("promove até o limite visível e anuncia o último que entrou", () => {
    const state = promote({ ...EMPTY_FEED, queue: [item("a"), item("b"), item("c"), item("d")] }, 3, describeItem);
    expect(state.shown.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(state.queue.map((i) => i.id)).toEqual(["d"]);
    expect(state.announce).toBe("Novo lance em Obra c");
    expect(promote(state, 3, describeItem)).toBe(state);
    const after = promote({ ...state, shown: state.shown.slice(1) }, 3, describeItem);
    expect(after.shown.map((i) => i.id)).toEqual(["b", "c", "d"]);
  });

  it("no celular mostra um por vez", () => {
    expect(promote({ ...EMPTY_FEED, queue: [item("a"), item("b")] }, 1, describeItem).shown.map((i) => i.id)).toEqual(["a"]);
  });
});
