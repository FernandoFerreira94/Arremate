import { describe, expect, it } from "vitest";
import { buildPublishBody, type PublishForm } from "./publish-form";

const form: PublishForm = { initial: "R$ 30.000,00", increment: "1.000", startsAt: "2026-10-24T10:00", endsAt: "2026-10-24T18:00" };

describe("publicação de lote", () => {
  it("envia só os cinco campos, com a obra escolhida do catálogo confiável", () => {
    const fromCatalog = { externalId: "10481", title: "<script>x</script>" };
    const result = buildPublishBody(form, fromCatalog);
    expect(result).toEqual({
      ok: true,
      body: { externalId: "10481", initialCents: "3000000", incrementCents: "100000", startsAt: "2026-10-24T13:00:00.000Z", endsAt: "2026-10-24T21:00:00.000Z" },
    });
  });
  it("mantém os campos e aponta cada erro", () => {
    const result = buildPublishBody({ initial: "abc", increment: "0", startsAt: "2026-10-24T18:00", endsAt: "2026-10-24T10:00" }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["endsAt", "increment", "initial", "item"]);
    }
  });
});
