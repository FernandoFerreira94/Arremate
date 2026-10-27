import { describe, expect, it } from "vitest";
import { LENS_SIZE, lensAt } from "./zoom";

describe("lupa sob o cursor", () => {
  const view = { width: 1000, height: 800 };
  const natural = { width: 2500, height: 2000 }; // cabe com fit 0,4 → 1000×800, sem barras

  it("centraliza o ponto do cursor na lupa e usa a resolução real (2,5× aqui)", () => {
    const lens = lensAt({ x: 500, y: 400 }, view, natural);
    expect(lens?.factor).toBe(2.5);
    expect(lens?.backgroundSize).toBe("2500px 2000px");
    // Centro da imagem (1250, 1000 no fundo ampliado) fica no centro da lupa.
    expect(lens?.backgroundPosition).toBe(`${LENS_SIZE / 2 - 1250}px ${LENS_SIZE / 2 - 1000}px`);
    expect(lens?.left).toBe(500 - LENS_SIZE / 2);
  });

  it("limita o aumento entre 2× e 4×", () => {
    expect(lensAt({ x: 10, y: 10 }, view, { width: 1000, height: 800 })?.factor).toBe(2);
    expect(lensAt({ x: 10, y: 10 }, view, { width: 8000, height: 6400 })?.factor).toBe(4);
  });

  it("não mostra lupa fora da imagem (barras do object-contain) nem sem tamanho", () => {
    const tall = { width: 1000, height: 2000 }; // fit 0,4 → 400×800, barras de 300 px dos lados
    expect(lensAt({ x: 100, y: 400 }, view, tall)).toBeNull();
    expect(lensAt({ x: 500, y: 400 }, view, tall)).not.toBeNull();
    expect(lensAt({ x: 1, y: 1 }, view, { width: 0, height: 0 })).toBeNull();
  });
});
