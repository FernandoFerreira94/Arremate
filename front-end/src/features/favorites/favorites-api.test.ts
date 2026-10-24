import { describe, expect, it } from "vitest";
import { orderFavorites } from "./favorites-api";

describe("orderFavorites", () => {
  it("põe encerrados no fim sem mudar a ordem relativa", () => {
    const items = [{ id: "a", state: "ENDED" }, { id: "b", state: "LIVE" }, { id: "c", state: "SCHEDULED" }, { id: "d", state: "ENDED" }];
    expect(orderFavorites(items).map((item) => item.id)).toEqual(["b", "c", "a", "d"]);
  });
});
