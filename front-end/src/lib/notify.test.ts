import { describe, expect, it } from "vitest";
import { messageOf, TOAST_DURATION } from "./notify";

describe("notify (C2)", () => {
  it("usa a mensagem da API quando existe e o texto local quando não", () => {
    expect(messageOf({ message: "Lote publicado." }, "x")).toBe("Lote publicado.");
    expect(messageOf({ message: "  " }, "fallback")).toBe("fallback");
    expect(messageOf(null, "fallback")).toBe("fallback");
  });

  it("durações da prancha T2", () => {
    expect(TOAST_DURATION).toMatchObject({ success: 4000, info: 4000, warning: 6000, error: 8000 });
    expect(TOAST_DURATION.action).toBe(Number.POSITIVE_INFINITY);
  });
});
